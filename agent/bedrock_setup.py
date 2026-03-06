"""
Bedrock Knowledge Base Setup & Infrastructure Creation

Programmatically creates and configures:
1. Bedrock Knowledge Base
2. OpenSearch Serverless vector store connection
3. S3 data source
4. Starts ingestion pipeline
"""

import json
import time
import boto3
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class BedrockKnowledgeBaseSetup:
    """Manages Bedrock Knowledge Base creation and configuration"""
    
    def __init__(
        self,
        region: str = "ap-south-1",
        s3_bucket: str = "fish-detection-project-2026",
        s3_prefix: str = "rag",
        kb_name: str = "fish-knowledge-base",
    ):
        self.region = region
        self.s3_bucket = s3_bucket
        self.s3_prefix = s3_prefix
        self.kb_name = kb_name
        
        self.bedrock_agent = boto3.client("bedrock-agent", region_name=region)
        self.bedrock_runtime = boto3.client("bedrock-agent-runtime", region_name=region)
        self.opensearch = boto3.client("opensearchserverless", region_name=region)
        self.iam = boto3.client("iam", region_name=region)
        self.s3 = boto3.client("s3", region_name=region)
        
        self.knowledge_base_id = None
        self.collection_arn = None
        
    def create_opensearch_collection(self) -> str:
        """
        Create OpenSearch Serverless collection for vector storage
        
        Returns:
            Collection ARN
        """
        collection_name = f"fish-kb-{int(time.time())}"
        
        logger.info(f"Creating OpenSearch Serverless collection: {collection_name}")
        
        try:
            response = self.opensearch.create_collection(
                name=collection_name,
                type="VECTORSEARCH",
                description="Vector store for fish knowledge base",
            )
            
            collection_arn = response["createCollectionDetail"]["arn"]
            logger.info(f"✓ Collection created: {collection_arn}")
            
            # Wait for collection to be active
            time.sleep(5)
            
            return collection_arn
            
        except Exception as e:
            logger.error(f"Error creating OpenSearch collection: {e}")
            raise
    
    def create_iam_role_for_kb(self) -> str:
        """
        Create IAM role for Bedrock Knowledge Base
        
        Returns:
            Role ARN
        """
        role_name = f"bedrock-kb-role-{int(time.time())}"
        
        assume_role_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "bedrock.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        logger.info(f"Creating IAM role: {role_name}")
        
        try:
            response = self.iam.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(assume_role_policy),
                Description="Role for Bedrock Knowledge Base"
            )
            
            role_arn = response["Role"]["Arn"]
            logger.info(f"✓ IAM role created: {role_arn}")
            
            # Attach policies
            self._attach_kb_policies(role_name)
            
            time.sleep(3)  # Wait for role to be available
            
            return role_arn
            
        except Exception as e:
            logger.error(f"Error creating IAM role: {e}")
            raise
    
    def _attach_kb_policies(self, role_name: str):
        """Attach required policies to KB role"""
        
        # S3 access policy
        s3_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject",
                        "s3:ListBucket"
                    ],
                    "Resource": [
                        f"arn:aws:s3:::{self.s3_bucket}",
                        f"arn:aws:s3:::{self.s3_bucket}/*"
                    ]
                }
            ]
        }
        
        self.iam.put_role_policy(
            RoleName=role_name,
            PolicyName="BedrockKBs3Access",
            PolicyDocument=json.dumps(s3_policy)
        )
        
        # OpenSearch access policy
        opensearch_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "aoss:APIAccessAll"
                    ],
                    "Resource": "*"
                }
            ]
        }
        
        self.iam.put_role_policy(
            RoleName=role_name,
            PolicyName="BedrockKBOpenSearchAccess",
            PolicyDocument=json.dumps(opensearch_policy)
        )
        
        # Bedrock model access
        bedrock_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "bedrock:InvokeModel"
                    ],
                    "Resource": [
                        f"arn:aws:bedrock:{self.region}::foundation-model/amazon.titan-embed-text-v1"
                    ]
                }
            ]
        }
        
        self.iam.put_role_policy(
            RoleName=role_name,
            PolicyName="BedrockKBModelAccess",
            PolicyDocument=json.dumps(bedrock_policy)
        )
        
        logger.info(f"✓ Policies attached to {role_name}")
    
    def create_knowledge_base(self, role_arn: str, collection_arn: str) -> str:
        """
        Create Bedrock Knowledge Base
        
        Args:
            role_arn: IAM role ARN for KB
            collection_arn: OpenSearch collection ARN
            
        Returns:
            Knowledge Base ID
        """
        logger.info(f"Creating Bedrock Knowledge Base: {self.kb_name}")
        
        try:
            response = self.bedrock_agent.create_knowledge_base(
                name=self.kb_name,
                description="Fish species knowledge base for Indian fishermen",
                roleArn=role_arn,
                knowledgeBaseConfiguration={
                    "type": "VECTOR",
                    "vectorKnowledgeBaseConfiguration": {
                        "embeddingModel": {
                            "provider": "BEDROCK",
                            "model": "amazon.titan-embed-text-v1"
                        },
                        "storageConfiguration": {
                            "type": "OPENSEARCH_SERVERLESS",
                            "opensearchServerlessConfiguration": {
                                "collectionArn": collection_arn,
                                "vectorIndexName": "fish-kb-index",
                                "fieldMappings": {
                                    "vectorField": "embedding",
                                    "textField": "text",
                                    "metadataField": "metadata"
                                }
                            }
                        }
                    }
                }
            )
            
            kb_id = response["knowledgeBaseId"]
            self.knowledge_base_id = kb_id
            logger.info(f"✓ Knowledge Base created: {kb_id}")
            
            return kb_id
            
        except Exception as e:
            logger.error(f"Error creating knowledge base: {e}")
            raise
    
    def create_data_source(self, kb_id: str, role_arn: str) -> str:
        """
        Create S3 data source for knowledge base
        
        Args:
            kb_id: Knowledge Base ID
            role_arn: IAM role ARN
            
        Returns:
            Data source ID
        """
        logger.info(f"Creating data source for KB: {kb_id}")
        
        try:
            response = self.bedrock_agent.create_data_source(
                knowledgeBaseId=kb_id,
                name=f"fish-kb-s3-source-{int(time.time())}",
                description="S3 data source with fish knowledge documents",
                dataSourceConfiguration={
                    "type": "S3",
                    "s3Configuration": {
                        "bucketArn": f"arn:aws:s3:::{self.s3_bucket}",
                        "inclusionPrefixes": [self.s3_prefix],
                        "exclusionPatterns": [".git/*", ".gitignore"]
                    }
                }
            )
            
            ds_id = response["dataSource"]["dataSourceId"]
            logger.info(f"✓ Data source created: {ds_id}")
            
            return ds_id
            
        except Exception as e:
            logger.error(f"Error creating data source: {e}")
            raise
    
    def start_ingestion_job(self, kb_id: str, ds_id: str) -> str:
        """
        Start data ingestion job to process S3 documents
        
        Args:
            kb_id: Knowledge Base ID
            ds_id: Data Source ID
            
        Returns:
            Ingestion job ID
        """
        logger.info(f"Starting ingestion job for KB: {kb_id}")
        
        try:
            response = self.bedrock_agent.start_ingestion_job(
                knowledgeBaseId=kb_id,
                dataSourceId=ds_id
            )
            
            ingestion_job_id = response["ingestionJob"]["ingestionJobId"]
            logger.info(f"✓ Ingestion job started: {ingestion_job_id}")
            
            return ingestion_job_id
            
        except Exception as e:
            logger.error(f"Error starting ingestion job: {e}")
            raise
    
    def get_ingestion_job_status(self, kb_id: str, ds_id: str, job_id: str) -> Dict[str, Any]:
        """
        Get status of ingestion job
        
        Args:
            kb_id: Knowledge Base ID
            ds_id: Data Source ID
            job_id: Ingestion Job ID
            
        Returns:
            Job status details
        """
        try:
            response = self.bedrock_agent.get_ingestion_job(
                knowledgeBaseId=kb_id,
                dataSourceId=ds_id,
                ingestionJobId=job_id
            )
            
            return response["ingestionJob"]
            
        except Exception as e:
            logger.error(f"Error getting ingestion job status: {e}")
            raise
    
    def wait_for_ingestion(
        self,
        kb_id: str,
        ds_id: str,
        job_id: str,
        max_wait_seconds: int = 600,
        check_interval: int = 10
    ):
        """
        Wait for ingestion job to complete
        
        Args:
            kb_id: Knowledge Base ID
            ds_id: Data Source ID
            job_id: Ingestion Job ID
            max_wait_seconds: Maximum wait time
            check_interval: Check interval in seconds
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            job_status = self.get_ingestion_job_status(kb_id, ds_id, job_id)
            status = job_status.get("status", "UNKNOWN")
            
            logger.info(f"Ingestion job status: {status}")
            
            if status == "COMPLETE":
                logger.info("✓ Ingestion completed successfully")
                return True
            
            elif status == "FAILED":
                logger.error(f"Ingestion failed: {job_status}")
                return False
            
            time.sleep(check_interval)
        
        logger.warning(f"Ingestion job still running after {max_wait_seconds}s")
        return False
    
    def setup_complete(self) -> Dict[str, str]:
        """
        Run complete setup: create KB infrastructure and start ingestion
        
        Returns:
            Dictionary with all created resource IDs
        """
        logger.info("=" * 60)
        logger.info("Starting Bedrock Knowledge Base Setup")
        logger.info("=" * 60)
        
        try:
            # Step 1: Create OpenSearch collection
            logger.info("\n[1/6] Creating OpenSearch collection...")
            collection_arn = self.create_opensearch_collection()
            self.collection_arn = collection_arn
            
            # Step 2: Create IAM role
            logger.info("\n[2/6] Creating IAM role...")
            role_arn = self.create_iam_role_for_kb()
            
            # Step 3: Create knowledge base
            logger.info("\n[3/6] Creating knowledge base...")
            kb_id = self.create_knowledge_base(role_arn, collection_arn)
            
            # Step 4: Create data source
            logger.info("\n[4/6] Creating S3 data source...")
            ds_id = self.create_data_source(kb_id, role_arn)
            
            # Step 5: Start ingestion
            logger.info("\n[5/6] Starting document ingestion...")
            job_id = self.start_ingestion_job(kb_id, ds_id)
            
            # Step 6: Wait for ingestion
            logger.info("\n[6/6] Waiting for ingestion to complete...")
            self.wait_for_ingestion(kb_id, ds_id, job_id)
            
            result = {
                "knowledge_base_id": kb_id,
                "collection_arn": collection_arn,
                "role_arn": role_arn,
                "data_source_id": ds_id,
                "ingestion_job_id": job_id,
                "s3_bucket": self.s3_bucket,
                "s3_prefix": self.s3_prefix,
                "region": self.region
            }
            
            logger.info("\n" + "=" * 60)
            logger.info("✓ Setup Complete!")
            logger.info("=" * 60)
            logger.info(f"Knowledge Base ID: {kb_id}")
            logger.info(f"Collection ARN: {collection_arn}")
            logger.info(f"Data Source ID: {ds_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"\n✗ Setup failed: {e}")
            raise


def save_kb_config(config: Dict[str, str], filepath: str = "kb_config.json"):
    """Save KB configuration to file for later use"""
    with open(filepath, "w") as f:
        json.dump(config, f, indent=2)
    logger.info(f"✓ Configuration saved: {filepath}")


def load_kb_config(filepath: str = "kb_config.json") -> Dict[str, str]:
    """Load KB configuration from file"""
    with open(filepath, "r") as f:
        return json.load(f)


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    load_dotenv()
    
    # Initialize setup
    setup = BedrockKnowledgeBaseSetup(
        region="ap-south-1",
        s3_bucket="fish-detection-project-2026",
        s3_prefix="rag",
        kb_name="fish-knowledge-base"
    )
    
    # Run setup
    config = setup.setup_complete()
    
    # Save config for later use
    save_kb_config(config, "kb_config.json")
    
    print("\n✅ Bedrock Knowledge Base setup completed!")
    print(f"Configuration saved to kb_config.json")
