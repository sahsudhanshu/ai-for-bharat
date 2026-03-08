"""
bedrock_setup.py  AWS Bedrock RAG Infrastructure (Python/boto3)

Two usage modes:
  1. Called from setup_bedrock_rag.ps1 to create the AOSS vector index:
       python bedrock_setup.py --create-index --endpoint <url> --index-name <name> --region <region>

  2. Full standalone setup (all-in-one alternative to the PowerShell script):
       python bedrock_setup.py --full-setup [options]

  AWS CLI does not support OpenSearch data-plane operations (index creation),
  so this Python script handles that step using opensearch-py + AWS Sig V4.

  S3 bucket must be in the same region as the Bedrock Knowledge Base (us-east-1).
"""

import argparse
import json
import os
import sys
import time
import boto3
import logging
from typing import Optional, Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

#  Constants 
DEFAULT_REGION          = "us-east-1"
DEFAULT_S3_BUCKET       = "fish-detection-project-2026"
DEFAULT_S3_PREFIX       = "rag-docs"
DEFAULT_COLLECTION_NAME = "fish-nova-collection"
DEFAULT_KB_NAME         = "fish-kb-nova"
DEFAULT_ROLE_NAME       = "bedrock-kb-fish-role"
DEFAULT_INDEX_NAME      = "fish-kb-index"
DEFAULT_EMBED_MODEL     = "amazon.nova-2-multimodal-embeddings-v1:0"
VECTOR_DIMENSION        = 1024  # Nova 2 Multimodal Embeddings output dimensions


#  Vector Index Creation 

def create_vector_index(endpoint: str, index_name: str, region: str) -> None:
    """
    Create KNN vector index in OpenSearch Serverless collection.

    AWS CLI cannot do this  we use opensearch-py with AWS Sig V4 (AOSS service).
    The index uses FAISS HNSW engine, 1024-dim vectors matching Nova 2 Multimodal Embeddings.
    """
    try:
        from opensearchpy import OpenSearch, RequestsHttpConnection
        from requests_aws4auth import AWS4Auth
    except ImportError:
        logger.error("Missing libraries. Run: pip install opensearch-py requests-aws4auth")
        sys.exit(1)

    host = endpoint.replace("https://", "").replace("http://", "")

    creds   = boto3.Session().get_credentials().get_frozen_credentials()
    awsauth = AWS4Auth(creds.access_key, creds.secret_key, region, "aoss",
                      session_token=creds.token)

    client = OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=60,
    )

    # Check if index already exists
    if client.indices.exists(index=index_name):
        logger.info(f"Index '{index_name}' already exists  skipping creation")
        return

    index_body = {
        "settings": {"index.knn": True},
        "mappings": {
            "properties": {
                "embedding": {
                    "type": "knn_vector",
                    "dimension": VECTOR_DIMENSION,
                    "method": {
                        "engine":     "faiss",
                        "space_type": "l2",
                        "name":       "hnsw",
                        "parameters": {"ef_construction": 512, "m": 16},
                    },
                },
                "text":     {"type": "text"},
                "metadata": {"type": "text"},
            }
        },
    }

    resp = client.indices.create(index=index_name, body=index_body)
    if resp.get("acknowledged"):
        logger.info(f" Vector index '{index_name}' created")
    else:
        raise RuntimeError(f"Index creation not acknowledged: {resp}")


#  Full Infrastructure Setup 

class BedrockRAGSetup:
    """
    Complete Bedrock RAG infrastructure setup using boto3/AWS SDK.
    Equivalent to setup_bedrock_rag.ps1 but purely Python.
    """

    def __init__(
        self,
        region:          str = DEFAULT_REGION,
        s3_bucket:       str = DEFAULT_S3_BUCKET,
        s3_prefix:       str = DEFAULT_S3_PREFIX,
        collection_name: str = DEFAULT_COLLECTION_NAME,
        kb_name:         str = DEFAULT_KB_NAME,
        role_name:       str = DEFAULT_ROLE_NAME,
        index_name:      str = DEFAULT_INDEX_NAME,
        embed_model:     str = DEFAULT_EMBED_MODEL,
    ):
        self.region          = region
        self.s3_bucket       = s3_bucket
        self.s3_prefix       = s3_prefix
        self.collection_name = collection_name
        self.kb_name         = kb_name
        self.role_name       = role_name
        self.index_name      = index_name
        self.embed_model     = embed_model

        self.bedrock_agent   = boto3.client("bedrock-agent",            region_name=region)
        self.aoss            = boto3.client("opensearchserverless",     region_name=region)
        self.iam             = boto3.client("iam")
        self.s3              = boto3.client("s3",                       region_name=region)
        self.sts             = boto3.client("sts")

        identity            = self.sts.get_caller_identity()
        self.account_id     = identity["Account"]
        self.caller_arn     = identity["Arn"]
        self.role_arn       = f"arn:aws:iam::{self.account_id}:role/{self.role_name}"

    #  S3 Upload 

    def upload_documents(self, local_dir: str) -> int:
        """Upload all files in local_dir to S3 rag-docs prefix."""
        import pathlib

        # Create bucket if needed
        try:
            self.s3.head_bucket(Bucket=self.s3_bucket)
            logger.info(f"Bucket exists: {self.s3_bucket}")
        except:
            logger.info(f"Creating bucket {self.s3_bucket} in {self.region}")
            if self.region == "us-east-1":
                self.s3.create_bucket(Bucket=self.s3_bucket)
            else:
                self.s3.create_bucket(
                    Bucket=self.s3_bucket,
                    CreateBucketConfiguration={"LocationConstraint": self.region},
                )
            # Block public access
            self.s3.put_public_access_block(
                Bucket=self.s3_bucket,
                PublicAccessBlockConfiguration={
                    "BlockPublicAcls": True, "IgnorePublicAcls": True,
                    "BlockPublicPolicy": True, "RestrictPublicBuckets": True,
                },
            )

        count = 0
        for path in pathlib.Path(local_dir).iterdir():
            if path.is_file() and not path.name.startswith("."):
                key = f"{self.s3_prefix}/{path.name}"
                self.s3.upload_file(str(path), self.s3_bucket, key)
                logger.info(f"  Uploaded: {key}")
                count += 1
        logger.info(f" {count} files uploaded to s3://{self.s3_bucket}/{self.s3_prefix}/")
        return count

    #  IAM Role 

    def create_iam_role(self) -> str:
        """Create or verify the IAM role for Bedrock Knowledge Base."""
        try:
            resp = self.iam.get_role(RoleName=self.role_name)
            logger.info(f"IAM role already exists: {self.role_name} — updating embed policy")
            role_arn = resp["Role"]["Arn"]
            # Always overwrite the embed policy so it matches the current model
            self.iam.put_role_policy(RoleName=self.role_name, PolicyName="BedrockKBembedAccess",
                PolicyDocument=json.dumps({"Version": "2012-10-17", "Statement": [{
                    "Effect": "Allow", "Action": ["bedrock:InvokeModel"],
                    "Resource": f"arn:aws:bedrock:{self.region}::foundation-model/{self.embed_model}",
                }]}))
            logger.info(" Embed policy updated")
            return role_arn
        except self.iam.exceptions.NoSuchEntityException:
            pass

        trust = {
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": "bedrock.amazonaws.com"},
                "Action":    "sts:AssumeRole",
                "Condition": {
                    "StringEquals": {"aws:SourceAccount": self.account_id},
                    "ArnLike":      {"aws:SourceArn": f"arn:aws:bedrock:{self.region}:{self.account_id}:knowledge-base/*"},
                },
            }],
        }
        resp = self.iam.create_role(
            RoleName=self.role_name,
            AssumeRolePolicyDocument=json.dumps(trust),
            Description="Bedrock Knowledge Base execution role (fish-ai project)",
        )
        role_arn = resp["Role"]["Arn"]
        logger.info(f" IAM role created: {role_arn}")

        # Inline policies
        self.iam.put_role_policy(RoleName=self.role_name, PolicyName="BedrockKBs3Access",
            PolicyDocument=json.dumps({"Version": "2012-10-17", "Statement": [{
                "Effect": "Allow", "Action": ["s3:GetObject", "s3:ListBucket"],
                "Resource": [f"arn:aws:s3:::{self.s3_bucket}", f"arn:aws:s3:::{self.s3_bucket}/*"],
            }]}))
        self.iam.put_role_policy(RoleName=self.role_name, PolicyName="BedrockKBaossAccess",
            PolicyDocument=json.dumps({"Version": "2012-10-17", "Statement": [{
                "Effect": "Allow", "Action": ["aoss:APIAccessAll"], "Resource": "*",
            }]}))
        self.iam.put_role_policy(RoleName=self.role_name, PolicyName="BedrockKBembedAccess",
            PolicyDocument=json.dumps({"Version": "2012-10-17", "Statement": [{
                "Effect": "Allow", "Action": ["bedrock:InvokeModel"],
                "Resource": f"arn:aws:bedrock:{self.region}::foundation-model/{self.embed_model}",
            }]}))
        logger.info(" IAM policies attached")
        time.sleep(15)
        return role_arn

    #  AOSS Policies 

    def _put_aoss_security_policy(self, name: str, policy_type: str, policy: list | dict):
        """Create AOSS security policy, ignoring ConflictException."""
        try:
            self.aoss.create_security_policy(
                name=name, type=policy_type,
                policy=json.dumps(policy),
            )
            logger.info(f"   {policy_type} policy '{name}' created")
        except self.aoss.exceptions.ConflictException:
            logger.info(f"  {policy_type} policy '{name}' already exists (OK)")

    def _put_aoss_access_policy(self, name: str, policy: list):
        try:
            self.aoss.create_access_policy(name=name, type="data", policy=json.dumps(policy))
            logger.info(f"   data access policy '{name}' created")
        except self.aoss.exceptions.ConflictException:
            logger.info(f"  data access policy '{name}' already exists (OK)")

    def create_aoss_policies(self):
        colname = self.collection_name
        # Encryption
        self._put_aoss_security_policy(f"{colname}-enc", "encryption", {
            "Rules":       [{"ResourceType": "collection", "Resource": [f"collection/{colname}"]}],
            "AWSOwnedKey": True,
        })
        # Network (public)
        self._put_aoss_security_policy(f"{colname}-net", "network", [{
            "Rules": [
                {"ResourceType": "collection", "Resource": [f"collection/{colname}"]},
                {"ResourceType": "dashboard",  "Resource": [f"collection/{colname}"]},
            ],
            "AllowFromPublic": True,
        }])
        # Data access (Bedrock role + current caller)
        self._put_aoss_access_policy(f"{colname}-access", [{
            "Rules": [
                {
                    "ResourceType": "index",
                    "Resource":     [f"index/{colname}/*"],
                    "Permission":   ["aoss:CreateIndex", "aoss:UpdateIndex", "aoss:DescribeIndex",
                                     "aoss:ReadDocument", "aoss:WriteDocument", "aoss:DeleteIndex"],
                },
                {
                    "ResourceType": "collection",
                    "Resource":     [f"collection/{colname}"],
                    "Permission":   ["aoss:CreateCollectionItems", "aoss:UpdateCollectionItems",
                                     "aoss:DescribeCollectionItems"],
                },
            ],
            "Principal": [self.role_arn, self.caller_arn],
        }])

    #  AOSS Collection 

    def create_aoss_collection(self) -> tuple[str, str]:
        """Create VECTORSEARCH collection, return (arn, endpoint)."""
        # Check if already exists
        list_resp = self.aoss.list_collections()
        for s in list_resp.get("collectionSummaries", []):
            if s["name"] == self.collection_name:
                cid = s["id"]
                logger.info(f"Collection already exists: {cid}")
                batch = self.aoss.batch_get_collection(ids=[cid])
                detail = batch["collectionDetails"][0]
                return detail["arn"], detail["collectionEndpoint"]

        resp = self.aoss.create_collection(
            name=self.collection_name, type="VECTORSEARCH",
            description="Vector store for Bedrock fish knowledge base",
        )
        cid = resp["createCollectionDetail"]["id"]
        logger.info(f"Collection creation started. ID: {cid}")

        # Poll until ACTIVE
        logger.info("Waiting for collection to become ACTIVE (36 min)...")
        for i in range(48):
            time.sleep(15)
            batch   = self.aoss.batch_get_collection(ids=[cid])
            detail  = batch["collectionDetails"][0]
            status  = detail["status"]
            elapsed = (i + 1) * 15
            logger.info(f"  [{elapsed}s] Status: {status}")
            if status == "ACTIVE":
                logger.info(f" Collection ACTIVE. Endpoint: {detail['collectionEndpoint']}")
                return detail["arn"], detail["collectionEndpoint"]
            if status == "FAILED":
                raise RuntimeError("Collection creation FAILED")

        raise RuntimeError("Collection did not become ACTIVE within 12 minutes")

    #  Bedrock Knowledge Base 

    def create_knowledge_base(self, collection_arn: str) -> str:
        """Create Bedrock KB, return KB ID."""
        # Check if exists
        for kb in self.bedrock_agent.list_knowledge_bases().get("knowledgeBaseSummaries", []):
            if kb["name"] == self.kb_name:
                logger.info(f"Knowledge Base already exists: {kb['knowledgeBaseId']}")
                return kb["knowledgeBaseId"]

        resp = self.bedrock_agent.create_knowledge_base(
            name=self.kb_name,
            description="Fish species, diseases, fishing techniques and regulations for AI-for-Bharat",
            roleArn=self.role_arn,
            knowledgeBaseConfiguration={
                "type": "VECTOR",
                "vectorKnowledgeBaseConfiguration": {
                    "embeddingModelArn": f"arn:aws:bedrock:{self.region}::foundation-model/{self.embed_model}",
                },
            },
            storageConfiguration={
                "type": "OPENSEARCH_SERVERLESS",
                "opensearchServerlessConfiguration": {
                    "collectionArn":  collection_arn,
                    "vectorIndexName": self.index_name,
                    "fieldMapping": {
                        "vectorField":   "embedding",
                        "textField":     "text",
                        "metadataField": "metadata",
                    },
                },
            },
        )
        kb_id = resp["knowledgeBase"]["knowledgeBaseId"]
        logger.info(f" Knowledge Base created: {kb_id}")

        # Wait for ACTIVE
        for _ in range(24):
            time.sleep(10)
            status = self.bedrock_agent.get_knowledge_base(knowledgeBaseId=kb_id)["knowledgeBase"]["status"]
            logger.info(f"  KB status: {status}")
            if status == "ACTIVE":
                break
            if "FAILED" in status:
                raise RuntimeError(f"KB creation failed: {status}")
        return kb_id

    #  Data Source + Ingestion 

    def create_data_source(self, kb_id: str) -> str:
        ds_name = "fish-rag-s3-source"
        for ds in self.bedrock_agent.list_data_sources(knowledgeBaseId=kb_id).get("dataSourceSummaries", []):
            if ds["name"] == ds_name:
                logger.info(f"Data source already exists: {ds['dataSourceId']}")
                return ds["dataSourceId"]

        resp = self.bedrock_agent.create_data_source(
            knowledgeBaseId=kb_id,
            name=ds_name,
            description="Fish knowledge markdown/PDF documents from S3",
            dataSourceConfiguration={
                "type": "S3",
                "s3Configuration": {
                    "bucketArn":        f"arn:aws:s3:::{self.s3_bucket}",
                    "inclusionPrefixes": [f"{self.s3_prefix}/"],
                },
            },
        )
        ds_id = resp["dataSource"]["dataSourceId"]
        logger.info(f" Data source created: {ds_id}")
        return ds_id

    def start_ingestion(self, kb_id: str, ds_id: str) -> str:
        resp   = self.bedrock_agent.start_ingestion_job(knowledgeBaseId=kb_id, dataSourceId=ds_id)
        job_id = resp["ingestionJob"]["ingestionJobId"]
        logger.info(f" Ingestion job started: {job_id}")
        return job_id

    #  Full Setup 

    def run_full_setup(self, rag_doc_dir: str) -> Dict[str, str]:
        logger.info("=" * 60)
        logger.info("Bedrock RAG Full Infrastructure Setup")
        logger.info("=" * 60)

        # 1. Upload docs
        logger.info("\n[1/7] Uploading documents to S3...")
        self.upload_documents(rag_doc_dir)

        # 2. IAM role
        logger.info("\n[2/7] Creating IAM role...")
        self.create_iam_role()

        # 3. AOSS policies
        logger.info("\n[3/7] Creating AOSS security policies...")
        self.create_aoss_policies()
        time.sleep(5)

        # 4. AOSS collection
        logger.info("\n[4/7] Creating AOSS collection...")
        collection_arn, collection_endpoint = self.create_aoss_collection()

        # 5. Vector index
        logger.info("\n[5/7] Creating KNN vector index...")
        time.sleep(30)  # Allow AOSS data-access policy to propagate
        create_vector_index(collection_endpoint, self.index_name, self.region)

        # 6. KB
        logger.info("\n[6/7] Creating Bedrock Knowledge Base...")
        kb_id = self.create_knowledge_base(collection_arn)

        # 7. Data source + ingestion
        logger.info("\n[7/7] Creating data source and starting ingestion...")
        ds_id  = self.create_data_source(kb_id)
        job_id = self.start_ingestion(kb_id, ds_id)

        config = {
            "knowledge_base_id":   kb_id,
            "collection_arn":      collection_arn,
            "collection_endpoint": collection_endpoint,
            "collection_name":     self.collection_name,
            "role_arn":            self.role_arn,
            "data_source_id":      ds_id,
            "ingestion_job_id":    job_id,
            "s3_bucket":           self.s3_bucket,
            "s3_prefix":           self.s3_prefix,
            "index_name":          self.index_name,
            "embed_model":         self.embed_model,
            "region":              self.region,
            "account_id":          self.account_id,
            "created_at":          time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        logger.info("\n" + "=" * 60)
        logger.info(" Setup Complete!")
        logger.info(f"  Knowledge Base ID  : {kb_id}")
        logger.info(f"  Collection ARN     : {collection_arn}")
        logger.info(f"  Data Source ID     : {ds_id}")
        logger.info(f"  Ingestion Job ID   : {job_id}")
        logger.info("=" * 60)
        return config


#  Config Helpers 

def save_kb_config(config: Dict[str, Any], filepath: str = "kb_config.json") -> None:
    with open(filepath, "w") as f:
        json.dump(config, f, indent=2)
    logger.info(f" Configuration saved: {filepath}")


def load_kb_config(filepath: str = "kb_config.json") -> Dict[str, Any]:
    with open(filepath, "r") as f:
        return json.load(f)


#  CLI Entry Point 

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bedrock RAG infrastructure setup")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--create-index", action="store_true",
                       help="Create vector index in an existing AOSS collection (called by setup_bedrock_rag.ps1)")
    group.add_argument("--full-setup",   action="store_true",
                       help="Run complete infrastructure setup (alternative to PowerShell script)")

    parser.add_argument("--endpoint",    help="AOSS collection endpoint (for --create-index)")
    parser.add_argument("--index-name",  default=DEFAULT_INDEX_NAME,      help="AOSS index name")
    parser.add_argument("--region",      default=DEFAULT_REGION,          help="AWS region (default: us-east-1)")
    parser.add_argument("--s3-bucket",   default=DEFAULT_S3_BUCKET,       help="S3 bucket name")
    parser.add_argument("--s3-prefix",   default=DEFAULT_S3_PREFIX,       help="S3 key prefix for docs")
    parser.add_argument("--collection",  default=DEFAULT_COLLECTION_NAME, help="AOSS collection name")
    parser.add_argument("--kb-name",     default=DEFAULT_KB_NAME,         help="Bedrock KB name")
    parser.add_argument("--role-name",   default=DEFAULT_ROLE_NAME,       help="IAM role name")
    parser.add_argument("--embed-model", default=DEFAULT_EMBED_MODEL,     help="Bedrock embedding model ID")
    parser.add_argument("--rag-docs",    default=None,  help="Path to RAGDocument directory (for --full-setup)")

    args = parser.parse_args()

    if args.create_index:
        if not args.endpoint:
            parser.error("--create-index requires --endpoint <collection-url>")
        create_vector_index(args.endpoint, args.index_name, args.region)
        sys.exit(0)

    if args.full_setup:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        rag_docs   = args.rag_docs or os.path.join(script_dir, "RAGDocument")

        if not os.path.isdir(rag_docs):
            logger.error(f"RAGDocument directory not found: {rag_docs}")
            sys.exit(1)

        setup = BedrockRAGSetup(
            region          = args.region,
            s3_bucket       = args.s3_bucket,
            s3_prefix       = args.s3_prefix,
            collection_name = args.collection,
            kb_name         = args.kb_name,
            role_name       = args.role_name,
            index_name      = args.index_name,
            embed_model     = args.embed_model,
        )

        config = setup.run_full_setup(rag_docs)
        save_kb_config(config)

        # Update .env with KB ID
        env_path = os.path.join(script_dir, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                env_content = f.read()
            import re
            if re.search(r"BEDROCK_KB_ID\s*=", env_content):
                env_content = re.sub(r"BEDROCK_KB_ID\s*=.*", f"BEDROCK_KB_ID={config['knowledge_base_id']}", env_content)
            else:
                env_content = env_content.rstrip() + f"\nBEDROCK_KB_ID={config['knowledge_base_id']}\n"
            with open(env_path, "w") as f:
                f.write(env_content)
            logger.info(f" .env updated: BEDROCK_KB_ID={config['knowledge_base_id']}")

        print(f"\n Bedrock Knowledge Base setup completed!")
        print(f"   Knowledge Base ID : {config['knowledge_base_id']}")
        print(f"   Config saved to   : kb_config.json")
