# FishAI — AWS Deployment Guide

## Prerequisites
- AWS Account with console access
- AWS CLI configured (`aws configure`)
- Node.js 20+ installed
- Amplify CLI (`npm install -g @aws-amplify/cli`)

---

## Step 1: Create Cognito User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name ai-bharat-users \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies PasswordPolicy="{MinimumLength=8,RequireUppercase=false,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --region ap-south-1
```

Note the **UserPoolId** from the output.

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <YOUR_POOL_ID> \
  --client-name fishai-web-client \
  --no-generate-secret \
  --region ap-south-1
```

Note the **ClientId**.

---

## Step 2: Create S3 Bucket

```bash
aws s3api create-bucket \
  --bucket ai-bharat-fish-images \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Block all public access
aws s3api put-public-access-block \
  --bucket ai-bharat-fish-images \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Set CORS (for presigned URL uploads from browser)
aws s3api put-bucket-cors \
  --bucket ai-bharat-fish-images \
  --cors-configuration file://infrastructure/s3-cors.json
```

Create `infrastructure/s3-cors.json`:
```json
{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
```

---

## Step 3: Create DynamoDB Tables

```bash
# Apply each table definition from infrastructure/dynamodb-tables.json
# (Run once per table)

aws dynamodb create-table \
  --table-name ai-bharat-images \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=imageId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
    AttributeName=status,AttributeType=S \
  --key-schema AttributeName=imageId,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"userId-createdAt-index\",\"KeySchema\":[{\"AttributeName\":\"userId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"createdAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --region ap-south-1

aws dynamodb create-table \
  --table-name ai-bharat-chats \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=chatId,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema AttributeName=chatId,KeyType=HASH \
  --global-secondary-indexes \
    "[{\"IndexName\":\"userId-timestamp-index\",\"KeySchema\":[{\"AttributeName\":\"userId\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"timestamp\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
  --region ap-south-1

aws dynamodb create-table \
  --table-name ai-bharat-users \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --region ap-south-1
```

---

## Step 4: Create IAM Role for Lambda

```bash
# Create role
aws iam create-role \
  --role-name ai-bharat-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policy (from infrastructure/iam-policies.json)
aws iam put-role-policy \
  --role-name ai-bharat-lambda-role \
  --policy-name ai-bharat-lambda-policy \
  --policy-document file://infrastructure/iam-policies.json
```

---

## Step 5: Deploy Lambda Functions

```bash
cd backend

# Install dependencies
npm install

# Package each function
zip -r getPresignedUrl.zip src/utils/ src/functions/getPresignedUrl.js node_modules/
zip -r getImages.zip src/utils/ src/functions/getImages.js node_modules/
zip -r analyzeImage.zip src/utils/ src/functions/analyzeImage.js node_modules/
zip -r sendChat.zip src/utils/ src/functions/sendChat.js node_modules/
zip -r getChatHistory.zip src/utils/ src/functions/getChatHistory.js node_modules/
zip -r getMapData.zip src/utils/ src/functions/getMapData.js node_modules/
zip -r getAnalytics.zip src/utils/ src/functions/getAnalytics.js node_modules/

# Deploy each function (example for getPresignedUrl)
aws lambda create-function \
  --function-name ai-bharat-getPresignedUrl \
  --runtime nodejs20.x \
  --role arn:aws:iam::<ACCOUNT_ID>:role/ai-bharat-lambda-role \
  --handler getPresignedUrl.handler \
  --zip-file fileb://getPresignedUrl.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{
    S3_BUCKET_NAME=ai-bharat-fish-images,
    DYNAMODB_IMAGES_TABLE=ai-bharat-images,
    COGNITO_USER_POOL_ID=<POOL_ID>,
    COGNITO_CLIENT_ID=<CLIENT_ID>,
    ML_API_URL=https://your-ml-api.example.com/analyze
  }" \
  --region ap-south-1
```

Repeat for all 7 functions.

---

## Step 6: Create API Gateway

```bash
aws apigateway create-rest-api \
  --name ai-bharat-api \
  --description "FishAI REST API" \
  --endpoint-configuration types=REGIONAL \
  --region ap-south-1
```

**API Routes to create:**
| Method | Path | Lambda |
|--------|------|--------|
| POST | /images/presigned-url | ai-bharat-getPresignedUrl |
| GET | /images | ai-bharat-getImages |
| POST | /images/{imageId}/analyze | ai-bharat-analyzeImage |
| POST | /chat | ai-bharat-sendChat |
| GET | /chat | ai-bharat-getChatHistory |
| GET | /map | ai-bharat-getMapData |
| GET | /analytics | ai-bharat-getAnalytics |

Enable **CORS** on all routes and deploy to a `prod` stage.

---

## Step 7: Deploy Frontend on AWS Amplify

1. Push your repository to GitHub/CodeCommit
2. Go to **AWS Amplify Console** → New App → Host Web App
3. Connect your repository and branch (`main`)
4. Build settings are auto-detected for Next.js
5. Add **Environment Variables** from `frontend/.env.example` with your real values
6. Click **Save and Deploy**

Amplify will auto-build and deploy on every push to `main`. 🎉

---

## Step 8: Update S3 CORS with Amplify Domain

After deployment, get your Amplify domain (e.g., `https://main.d1234abcd.amplifyapp.com`) and update the S3 CORS `AllowedOrigins`.

---

## Cost Estimation (10,000 users/month)

| Service | Usage | Estimated Cost |
|---------|-------|----------------|
| Lambda | 1M requests × 1s avg | ~$0.60 |
| API Gateway | 1M API calls | ~$3.50 |
| DynamoDB | 5M R/W, 10GB storage | ~$4.00 |
| S3 | 50GB storage, 500K requests | ~$5.00 |
| Cognito | 10K MAU (free tier) | $0.00 |
| Amplify | Hosting + CI/CD | ~$3.00 |
| CloudWatch | Logs + monitoring | ~$2.00 |
| **Total** | | **~$18/month** |

> 💡 **Cost Optimization Tips:**
> - Enable DynamoDB TTL on images older than 2 years
> - Use S3 Intelligent-Tiering for infrequently accessed images
> - Set Lambda concurrency limits to prevent runaway costs
> - Enable API Gateway caching (e.g., 5 min for /analytics)
> - Use CloudFront in front of API Gateway for caching

---

## Monitoring & Observability

```bash
# View Lambda logs in real time
aws logs tail /aws/lambda/ai-bharat-getPresignedUrl --follow

# Create CloudWatch Dashboard
aws cloudwatch put-dashboard \
  --dashboard-name FishAI-Dashboard \
  --dashboard-body file://infrastructure/cloudwatch-dashboard.json
```

**Recommended CloudWatch Alarms:**
- Lambda error rate > 1%
- DynamoDB throttled requests > 10/min
- API Gateway 5XX rate > 0.5%
- Lambda duration > 5000ms
