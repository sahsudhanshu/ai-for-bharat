<#
.SYNOPSIS
    AWS Bedrock RAG Full Infrastructure Setup via AWS CLI
    
.DESCRIPTION
    Creates the complete Bedrock Knowledge Base infrastructure:
      - S3 bucket upload (RAGDocument/ → s3://fish-detection-project-2026/rag-docs/)
      - IAM role with S3, AOSS, and Bedrock embedding permissions
      - OpenSearch Serverless collection (VECTORSEARCH type) with encryption/network/data policies
      - Vector index in AOSS (via Python opensearch-py, since AWS CLI doesn't support index creation)
      - Bedrock Knowledge Base using Amazon Titan Embeddings V2
      - S3 data source linked to the Knowledge Base
      - Ingestion job to index documents
      - Saves config to kb_config.json and updates .env with BEDROCK_KB_ID

.EXAMPLE
    .\setup_bedrock_rag.ps1
    .\setup_bedrock_rag.ps1 -Region us-east-1 -S3Bucket my-custom-bucket
#>

param(
    [string]$Region         = "us-east-1",
    [string]$S3Bucket       = "fish-detection-project-2026",
    [string]$S3Prefix       = "rag-docs",
    [string]$CollectionName = "fish-kb-collection",
    [string]$KBName         = "fish-knowledge-base",
    [string]$RoleName       = "bedrock-kb-fish-role",
    [string]$IndexName      = "fish-kb-index",
    [string]$EmbedModel     = "amazon.titan-embed-text-v2:0"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AWS Bedrock RAG Infrastructure Setup"                       -ForegroundColor Cyan
Write-Host "  Region  : $Region"                                          -ForegroundColor Cyan
Write-Host "  Bucket  : $S3Bucket/$S3Prefix"                             -ForegroundColor Cyan
Write-Host "  KB Name : $KBName"                                          -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ── STEP 0: Verify AWS CLI & get account ───────────────────────────────────
Write-Host "`n[STEP 0] Verifying AWS CLI and credentials..." -ForegroundColor Yellow

try { aws --version | Out-Null } catch { Write-Error "AWS CLI not found. Install it: https://aws.amazon.com/cli/" }

$CallerIdentity = aws sts get-caller-identity | ConvertFrom-Json
$AccountId      = $CallerIdentity.Account
$CallerArn      = $CallerIdentity.Arn
$RoleArn        = "arn:aws:iam::${AccountId}:role/$RoleName"

Write-Host "  Account ID : $AccountId"
Write-Host "  Caller ARN : $CallerArn"
Write-Host "  OK" -ForegroundColor Green


# ── STEP 1: Upload RAGDocument files to S3 ─────────────────────────────────
Write-Host "`n[STEP 1] Uploading RAGDocument files to S3..." -ForegroundColor Yellow

$RagDocPath = Join-Path $ScriptDir "RAGDocument"
if (-not (Test-Path $RagDocPath)) {
    Write-Error "RAGDocument folder not found at: $RagDocPath"
}

# Create bucket in us-east-1 if it doesn't exist
# Note: us-east-1 does NOT use LocationConstraint (AWS quirk)
$BucketCheck = aws s3api head-bucket --bucket $S3Bucket --region $Region 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Creating S3 bucket: $S3Bucket in $Region"
    if ($Region -eq "us-east-1") {
        aws s3api create-bucket --bucket $S3Bucket --region $Region | Out-Null
    } else {
        $locationConstraint = "{`"LocationConstraint`": `"$Region`"}"
        aws s3api create-bucket --bucket $S3Bucket --region $Region --create-bucket-configuration $locationConstraint | Out-Null
    }
    Write-Host "  Bucket created" -ForegroundColor Green
} else {
    Write-Host "  Bucket already exists"
}

# Block public access for security (Bedrock accesses via IAM role, not public)
aws s3api put-public-access-block `
    --bucket $S3Bucket `
    --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" `
    --region $Region 2>&1 | Out-Null

# Upload files
Write-Host "  Uploading from $RagDocPath"
aws s3 sync $RagDocPath "s3://$S3Bucket/$S3Prefix/" `
    --region $Region `
    --exclude ".gitkeep" `
    --exclude "*.gitignore"

Write-Host "  Files uploaded to s3://$S3Bucket/$S3Prefix/" -ForegroundColor Green
# List uploaded files
aws s3 ls "s3://$S3Bucket/$S3Prefix/" --region $Region


# ── STEP 2: Create IAM Role for Bedrock Knowledge Base ─────────────────────
Write-Host "`n[STEP 2] Creating IAM role for Bedrock Knowledge Base..." -ForegroundColor Yellow

$RoleExists = aws iam get-role --role-name $RoleName 2>&1
if ($LASTEXITCODE -ne 0) {
    # Trust policy — allows Bedrock service to assume this role
    $TrustPolicy = @{
        Version   = "2012-10-17"
        Statement = @(
            @{
                Effect    = "Allow"
                Principal = @{ Service = "bedrock.amazonaws.com" }
                Action    = "sts:AssumeRole"
                Condition = @{
                    StringEquals = @{ "aws:SourceAccount" = $AccountId }
                    ArnLike      = @{ "aws:SourceArn" = "arn:aws:bedrock:${Region}:${AccountId}:knowledge-base/*" }
                }
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress

    aws iam create-role `
        --role-name $RoleName `
        --assume-role-policy-document $TrustPolicy `
        --description "Bedrock Knowledge Base execution role for fish-ai project" | Out-Null

    Write-Host "  Role created: $RoleName" -ForegroundColor Green
} else {
    Write-Host "  Role already exists: $RoleName"
}

# S3 read access
$S3Policy = @{
    Version   = "2012-10-17"
    Statement = @(
        @{
            Effect   = "Allow"
            Action   = @("s3:GetObject", "s3:ListBucket")
            Resource = @(
                "arn:aws:s3:::$S3Bucket",
                "arn:aws:s3:::${S3Bucket}/*"
            )
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

aws iam put-role-policy --role-name $RoleName --policy-name "BedrockKBs3Access" --policy-document $S3Policy | Out-Null
Write-Host "  S3 access policy attached"

# OpenSearch Serverless access
$AossPolicy = @{
    Version   = "2012-10-17"
    Statement = @(
        @{
            Effect   = "Allow"
            Action   = @("aoss:APIAccessAll")
            Resource = "*"
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

aws iam put-role-policy --role-name $RoleName --policy-name "BedrockKBaossAccess" --policy-document $AossPolicy | Out-Null
Write-Host "  AOSS access policy attached"

# Bedrock embedding model invocation
$BedrockPolicy = @{
    Version   = "2012-10-17"
    Statement = @(
        @{
            Effect   = "Allow"
            Action   = @("bedrock:InvokeModel")
            Resource = "arn:aws:bedrock:${Region}::foundation-model/$EmbedModel"
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

aws iam put-role-policy --role-name $RoleName --policy-name "BedrockKBembedAccess" --policy-document $BedrockPolicy | Out-Null
Write-Host "  Bedrock embed access policy attached"

Write-Host "  Waiting 15s for IAM to propagate..."
Start-Sleep -Seconds 15
Write-Host "  IAM setup complete" -ForegroundColor Green


# ── STEP 3: OpenSearch Serverless Security Policies ────────────────────────
Write-Host "`n[STEP 3] Creating OpenSearch Serverless security policies..." -ForegroundColor Yellow

$CollectionResource = "collection/$CollectionName"

# Encryption policy (AWS-managed key)
$EncPolicy = (@(
    @{
        Rules       = @( @{ ResourceType = "collection"; Resource = @($CollectionResource) } )
        AWSOwnedKey = $true
    }
) | ConvertTo-Json -Depth 10 -Compress)

$EncResult = aws opensearchserverless create-security-policy `
    --name "${CollectionName}-enc" `
    --type encryption `
    --policy $EncPolicy `
    --region $Region 2>&1

if ($LASTEXITCODE -ne 0 -and "$EncResult" -match "ConflictException") {
    Write-Host "  Encryption policy already exists (OK)"
} elseif ($LASTEXITCODE -ne 0) {
    Write-Host "  Warning: encryption policy: $EncResult" -ForegroundColor Yellow
} else {
    Write-Host "  Encryption policy created" -ForegroundColor Green
}

# Network policy (public access — Bedrock agent needs public endpoint)
$NetPolicy = (@(
    @{
        Rules = @(
            @{ ResourceType = "collection"; Resource = @($CollectionResource) },
            @{ ResourceType = "dashboard";  Resource = @($CollectionResource) }
        )
        AllowFromPublic = $true
    }
) | ConvertTo-Json -Depth 10 -Compress)

$NetResult = aws opensearchserverless create-security-policy `
    --name "${CollectionName}-net" `
    --type network `
    --policy $NetPolicy `
    --region $Region 2>&1

if ($LASTEXITCODE -ne 0 -and "$NetResult" -match "ConflictException") {
    Write-Host "  Network policy already exists (OK)"
} elseif ($LASTEXITCODE -ne 0) {
    Write-Host "  Warning: network policy: $NetResult" -ForegroundColor Yellow
} else {
    Write-Host "  Network policy created" -ForegroundColor Green
}

# Data access policy — grants Bedrock role + current caller full index permissions
$DataPolicy = (@(
    @{
        Rules = @(
            @{
                ResourceType = "index"
                Resource     = @("index/${CollectionName}/*")
                Permission   = @(
                    "aoss:CreateIndex", "aoss:UpdateIndex", "aoss:DescribeIndex",
                    "aoss:ReadDocument", "aoss:WriteDocument", "aoss:DeleteIndex"
                )
            },
            @{
                ResourceType = "collection"
                Resource     = @($CollectionResource)
                Permission   = @(
                    "aoss:CreateCollectionItems",
                    "aoss:UpdateCollectionItems",
                    "aoss:DescribeCollectionItems"
                )
            }
        )
        Principal = @($RoleArn, $CallerArn)
    }
) | ConvertTo-Json -Depth 10 -Compress)

$DataResult = aws opensearchserverless create-access-policy `
    --name "${CollectionName}-access" `
    --type data `
    --policy $DataPolicy `
    --region $Region 2>&1

if ($LASTEXITCODE -ne 0 -and "$DataResult" -match "ConflictException") {
    Write-Host "  Data access policy already exists (OK)"
} elseif ($LASTEXITCODE -ne 0) {
    Write-Host "  Warning: data access policy: $DataResult" -ForegroundColor Yellow
} else {
    Write-Host "  Data access policy created" -ForegroundColor Green
}


# ── STEP 4: Create OpenSearch Serverless Collection ────────────────────────
Write-Host "`n[STEP 4] Creating OpenSearch Serverless collection: $CollectionName..." -ForegroundColor Yellow

$CollectionId       = $null
$CollectionArn      = $null
$CollectionEndpoint = $null

# Check if collection already exists
$ListResult = aws opensearchserverless list-collections --region $Region | ConvertFrom-Json
$ExistingColl = $ListResult.collectionSummaries | Where-Object { $_.name -eq $CollectionName }

if ($ExistingColl) {
    $CollectionId = $ExistingColl.id
    Write-Host "  Collection already exists: $CollectionId"
} else {
    $CreateResult = aws opensearchserverless create-collection `
        --name $CollectionName `
        --type VECTORSEARCH `
        --description "Vector store for Bedrock fish knowledge base" `
        --region $Region | ConvertFrom-Json

    $CollectionId = $CreateResult.createCollectionDetail.id
    Write-Host "  Collection creation started. ID: $CollectionId"
}

# Poll until ACTIVE
Write-Host "  Waiting for collection to become ACTIVE (typically 3–6 minutes)..."
for ($i = 0; $i -lt 48; $i++) {
    Start-Sleep -Seconds 15
    $BatchResult  = aws opensearchserverless batch-get-collection --ids $CollectionId --region $Region | ConvertFrom-Json
    $CollDetail   = $BatchResult.collectionDetails[0]
    $CollStatus   = $CollDetail.status
    $Elapsed      = ($i + 1) * 15

    Write-Host "  [$Elapsed s] Status: $CollStatus"

    if ($CollStatus -eq "ACTIVE") {
        $CollectionArn      = $CollDetail.arn
        $CollectionEndpoint = $CollDetail.collectionEndpoint
        Write-Host "  Collection is ACTIVE!" -ForegroundColor Green
        Write-Host "  ARN      : $CollectionArn"
        Write-Host "  Endpoint : $CollectionEndpoint"
        break
    }
    if ($CollStatus -eq "FAILED") {
        Write-Error "Collection creation FAILED. Check AWS console for details."
    }
}

if (-not $CollectionEndpoint) {
    Write-Error "Collection did not become ACTIVE within 12 minutes. Check AWS console."
}


# ── STEP 5: Create Vector Index via Python (opensearch-py) ─────────────────
# AWS CLI doesn't support OpenSearch data-plane operations (index creation).
# We call bedrock_setup.py --create-index which uses opensearch-py + AWS Sig V4.
Write-Host "`n[STEP 5] Creating KNN vector index in OpenSearch Serverless..." -ForegroundColor Yellow
Write-Host "  (Index creation requires opensearch-py; invoking bedrock_setup.py)"

$SetupScript = Join-Path $ScriptDir "bedrock_setup.py"
python $SetupScript `
    --create-index `
    --endpoint $CollectionEndpoint `
    --index-name $IndexName `
    --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Error "Vector index creation failed. See error above."
}
Write-Host "  Vector index '$IndexName' ready" -ForegroundColor Green


# ── STEP 6: Create Bedrock Knowledge Base ──────────────────────────────────
Write-Host "`n[STEP 6] Creating Bedrock Knowledge Base: $KBName..." -ForegroundColor Yellow

$KBId = $null

# Check if KB already exists with this name
$ListKBs = aws bedrock-agent list-knowledge-bases --region $Region | ConvertFrom-Json
$ExistingKB = $ListKBs.knowledgeBaseSummaries | Where-Object { $_.name -eq $KBName }

if ($ExistingKB) {
    $KBId = $ExistingKB.knowledgeBaseId
    Write-Host "  Knowledge Base already exists: $KBId"
} else {
    $KBConfig = @{
        type = "VECTOR"
        vectorKnowledgeBaseConfiguration = @{
            embeddingModelArn = "arn:aws:bedrock:${Region}::foundation-model/$EmbedModel"
        }
    } | ConvertTo-Json -Depth 10 -Compress

    $StorageConfig = @{
        type = "OPENSEARCH_SERVERLESS"
        opensearchServerlessConfiguration = @{
            collectionArn   = $CollectionArn
            vectorIndexName = $IndexName
            fieldMapping    = @{
                vectorField   = "embedding"
                textField     = "text"
                metadataField = "metadata"
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress

    $KBResult = aws bedrock-agent create-knowledge-base `
        --name $KBName `
        --description "Fish species, diseases, fishing techniques and regulations for AI-for-Bharat" `
        --role-arn $RoleArn `
        --knowledge-base-configuration $KBConfig `
        --storage-configuration $StorageConfig `
        --region $Region | ConvertFrom-Json

    $KBId = $KBResult.knowledgeBase.knowledgeBaseId
    Write-Host "  Knowledge Base created. ID: $KBId" -ForegroundColor Green

    # Wait for KB to be ACTIVE
    Write-Host "  Waiting for KB to be ACTIVE..."
    for ($i = 0; $i -lt 24; $i++) {
        Start-Sleep -Seconds 10
        $KBStatus = aws bedrock-agent get-knowledge-base --knowledge-base-id $KBId --region $Region | ConvertFrom-Json
        $KBState  = $KBStatus.knowledgeBase.status
        Write-Host "  [$($($i+1)*10) s] KB Status: $KBState"
        if ($KBState -eq "ACTIVE") { Write-Host "  KB is ACTIVE!" -ForegroundColor Green; break }
        if ($KBState -like "*FAILED*") { Write-Error "KB creation failed: $KBState" }
    }
}


# ── STEP 7: Create S3 Data Source ──────────────────────────────────────────
Write-Host "`n[STEP 7] Creating S3 data source for Knowledge Base..." -ForegroundColor Yellow

$DataSourceId = $null

# Check if data source already exists
$ListDS = aws bedrock-agent list-data-sources --knowledge-base-id $KBId --region $Region | ConvertFrom-Json
$ExistingDS = $ListDS.dataSourceSummaries | Where-Object { $_.name -eq "fish-rag-s3-source" }

if ($ExistingDS) {
    $DataSourceId = $ExistingDS.dataSourceId
    Write-Host "  Data source already exists: $DataSourceId"
} else {
    $DSConfig = @{
        type = "S3"
        s3Configuration = @{
            bucketArn         = "arn:aws:s3:::$S3Bucket"
            inclusionPrefixes = @("${S3Prefix}/")
        }
    } | ConvertTo-Json -Depth 10 -Compress

    $DSResult = aws bedrock-agent create-data-source `
        --knowledge-base-id $KBId `
        --name "fish-rag-s3-source" `
        --description "Fish knowledge markdown and PDF documents from S3" `
        --data-source-configuration $DSConfig `
        --region $Region | ConvertFrom-Json

    $DataSourceId = $DSResult.dataSource.dataSourceId
    Write-Host "  Data source created. ID: $DataSourceId" -ForegroundColor Green
}


# ── STEP 8: Start Ingestion Job ─────────────────────────────────────────────
Write-Host "`n[STEP 8] Starting document ingestion job..." -ForegroundColor Yellow

$IngestResult = aws bedrock-agent start-ingestion-job `
    --knowledge-base-id $KBId `
    --data-source-id $DataSourceId `
    --region $Region | ConvertFrom-Json

$IngestionJobId = $IngestResult.ingestionJob.ingestionJobId
Write-Host "  Ingestion job started. ID: $IngestionJobId" -ForegroundColor Green
Write-Host "  NOTE: Ingestion runs in background. Check status with:"
Write-Host "    aws bedrock-agent get-ingestion-job --knowledge-base-id $KBId --data-source-id $DataSourceId --ingestion-job-id $IngestionJobId --region $Region"


# ── STEP 9: Save Configuration ─────────────────────────────────────────────
Write-Host "`n[STEP 9] Saving configuration to kb_config.json and .env..." -ForegroundColor Yellow

$Config = @{
    knowledge_base_id    = $KBId
    collection_arn       = $CollectionArn
    collection_endpoint  = $CollectionEndpoint
    collection_id        = $CollectionId
    collection_name      = $CollectionName
    role_arn             = $RoleArn
    data_source_id       = $DataSourceId
    ingestion_job_id     = $IngestionJobId
    s3_bucket            = $S3Bucket
    s3_prefix            = $S3Prefix
    index_name           = $IndexName
    embed_model          = $EmbedModel
    region               = $Region
    account_id           = $AccountId
    created_at           = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json -Depth 5

$ConfigPath = Join-Path $ScriptDir "kb_config.json"
$Config | Out-File -FilePath $ConfigPath -Encoding UTF8
Write-Host "  Saved: $ConfigPath" -ForegroundColor Green

# Update .env with BEDROCK_KB_ID
$EnvPath    = Join-Path $ScriptDir ".env"
$EnvContent = Get-Content $EnvPath -Raw

if ($EnvContent -match "BEDROCK_KB_ID\s*=") {
    $EnvContent = $EnvContent -replace "BEDROCK_KB_ID\s*=.*", "BEDROCK_KB_ID=$KBId"
} else {
    $EnvContent = $EnvContent.TrimEnd() + "`nBEDROCK_KB_ID=$KBId`n"
}

$EnvContent | Out-File -FilePath $EnvPath -Encoding UTF8 -NoNewline
Write-Host "  .env updated: BEDROCK_KB_ID=$KBId" -ForegroundColor Green


# ── DONE ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "  Knowledge Base ID  : $KBId"
Write-Host "  Collection ARN     : $CollectionArn"
Write-Host "  Data Source ID     : $DataSourceId"
Write-Host "  Ingestion Job ID   : $IngestionJobId"
Write-Host "  Config file        : kb_config.json"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Wait 5-10 min for ingestion to complete:"
Write-Host "     aws bedrock-agent get-ingestion-job --knowledge-base-id $KBId --data-source-id $DataSourceId --ingestion-job-id $IngestionJobId --region $Region"
Write-Host ""
Write-Host "  2. Test retrieval:"
Write-Host "     python rag_retriever.py"
Write-Host ""
Write-Host "  3. Start the agent:"
Write-Host "     python run_local.py"
Write-Host "============================================================" -ForegroundColor Cyan
