# 🏗️ AI-Powered Fisherman's Assistant — Software Architecture Document (SAD)

## 📌 1. Project Overview

### Background
Small-scale fishing in India sustains millions of livelihoods but is plagued by systemic inefficiencies. Fishermen lack tools to accurately estimate catch weight without physical scales on a moving boat, struggle to identify species value in real-time, and often face exploitation from middlemen due to asymmetric market information.

### Vision
To transform smartphones into scientific instruments and strategic business consultants for small-scale fishermen, bridging the gap between perception (seeing the catch) and profit (selling at optimal value).

### High-level Description
The system is a "Perception-to-Action" pipeline integrating mobile photography, Edge-to-Cloud AI models (YOLOv11, Depth Estimation, classification), and an Agentic AI backend (LangGraph + Amazon Bedrock) to assess fish weight/quality and negotiate real-time market opportunities. 

---

## 🛑 2. Problem Statement

### Real-world Issue Being Solved
1. **Pricing Uncertainty**: Fishermen cannot accurately value their catch before reaching shore.
2. **Asymmetric Market Access**: Middlemen dictate prices; fishermen lack real-time visibility into local market trends.
3. **Logistical Constraints**: Weighing fish on turbulent seas is inaccurate and time-consuming.

### Target Users
- Traditional, small-scale fishermen in India (often low-literacy).
- Fish buyers and fishing cooperatives.

### Existing Gaps
Current solutions are either expensive hardware (IoT scales) unsuitable for small boats or generalized market apps that do not verify the actual catch or assist in active price negotiation.

---

## 🎯 3. Objectives and Scope

### Functional Scope
- **Vision AI**: Detect species, estimate dimensions from depth data, calculate weight ($W = a \cdot L^b$), and grade quality.
- **Agentic AI**: Pull market prices, optimize selling locations considering fuel/freshness costs, and initiate buyer chat.
- **Client Interfaces**: Next.js responsive Web App and Expo React Native mobile application.

### Non-functional Scope
- **Accessibility**: Voice-operated interface supporting 10+ regional Indian languages.
- **Offline Reliability**: Core UI and local object detection fallback must operate without an active internet connection.
- **Speed**: End-to-end cloud processing latency <3 seconds.

### Out-of-scope Items
- Hardware integration (on-board sensors, integrated scales).
- Direct payment processing or escrow services (Phase 1).
- Satellite-based weather modeling (relies on third-party APIs).

---

## 🏗️ 4. System Architecture

### High-Level Architecture Diagram
```text
┌──────────────────────────────────────────────────────────────┐
│                        USER LAYER                            │
│ ┌───────────────┐  ┌─────────────────────────────────┐       │
│ │ Mobile App    │  │ Next.js Web App                 │       │
│ │ (Expo / RN)   │  │ (Dashboard, Capture, Analytics) │       │
│ └───────────────┘  └─────────────────────────────────┘       │
└────────────────────────────┬─────────────────────────────────┘
                             │ REST / WebSocket
┌────────────────────────────▼─────────────────────────────────┐
│                      BACKEND (AWS)                           │
│ ┌─────────────────────┐               ┌────────────────────┐ │
│ │ Auth & Sync         │               │ Agentic Orchestrator │
│ │ (Cognito / API GW)  │               │ (FastAPI + LangGraph)│
│ └─────────────────────┘               └────────────────────┘ │
│ ┌─────────────────────┐               ┌────────────────────┐ │
│ │ Catch API           │               │ External Integrations│
│ │ (Node.js Lambdas)   │               │ (Weather, e-NAM)   │
│ └─────────────────────┘               └────────────────────┘ │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│               AI / ML PIPELINE (SageMaker)                   │
│ ┌─────────┐   ┌──────────────┐   ┌────────────┐   ┌────────┐ │
│ │ YOLOv11 │ ─>│ EfficientNet │ ─>│ Depth V2 & │ ─>│ Formula│ │
│ │ (Detect)│   │ (Classify)   │   │ Mask R-CNN │   │ Metrics│ │
│ └─────────┘   └──────────────┘   └────────────┘   └────────┘ │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                        DATA STORE                            │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐ │
│ │ S3 (Images)    │ │ DynamoDB       │ │ Bedrock Memory     │ │
│ │                │ │ (Catch/Users)  │ │ (LangGraph history)│ │
│ └────────────────┘ └────────────────┘ └────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Component Breakdown
1. **Frontend**: Next.js 14 Web UI and Expo React Native mobile apps offering identical capability offline-first.
2. **API Backend**: Serverless AWS Lambda Node.js handlers for image presigning and CRUD. 
3. **Agent AI Backend**: Python FastAPI application utilizing `langchain-aws` over Amazon Bedrock. Graph-based orchestration using `LangGraph`.
4. **Machine Learning Pipeline**: Multi-model sequential inference deployed on SageMaker.
5. **Database**: Amazon DynamoDB for relational/document state management.

---

## 🔁 5. Complete Input → Processing → Output Flow

### Image Processing Flow (Sequence)
1. **User (Mobile)**: Captures a photo of the catch.
2. **Frontend**: Requests an S3 presigned URL from `POST /images/presigned-url`.
3. **Backend**: Returns secure direct-upload URL.
4. **Frontend**: PUTs image directly to Amazon S3. 
5. **Frontend**: Triggers `POST /images/{id}/analyze`.
6. **Backend**: Updates DynamoDB status to `processing`. Invokes SageMaker ML pipeline.
7. **ML Pipeline**: 
   - YOLO detects fish bounding boxes.
   - EfficientNet classifies species and assesses visual quality.
   - Depth model estimates 3D dimensions.
   - Metrics Engine outputs final weight estimate.
8. **Backend**: Saves ML output to DynamoDB records, updating status to `completed`.
9. **Frontend**: Polls or receives WS push causing UI update with weight, quality, and species.

### Agentic Chat Flow (Sequence)
1. **User**: Ask questions in local language (e.g., "Hindi: Market price of Pomfret?").
2. **Mobile/Web**: POST to local/live AI agent (`POST /chat`).
3. **Agent (FastAPI)**: Validates language constraints via `language_guard` node.
4. **Agent (LangGraph)**: Constructs prompt using `history`, `long-term-memory`, and `catch-context`.
5. **AI (Bedrock)**: LLM analyzes query and requests tool calls (e.g. `get_market_prices`).
6. **Agent**: Executes `get_market_prices`, appending to LLM stream.
7. **AI**: LLM finalizes response utilizing tool data.
8. **Agent**: Saves conversational turn to DynamoDB, updating summary. Returns response to UI.

---

## 🌐 6. Complete API Documentation

### Node.js Backend 

#### `POST /images/presigned-url`
- **Purpose**: Get secure S3 upload URL for an image.
- **Auth**: Yes (Bearer Token)
- **Request Body**: 
  ```json
  { "fileName": "catch_1.jpg", "fileType": "image/jpeg", "latitude": 15.5, "longitude": 73.8 }
  ```
- **Response** (200):
  ```json
  { "uploadUrl": "https://s3...", "imageId": "uuid-...", "s3Path": "s3://..." }
  ```

#### `POST /images/{imageId}/analyze`
- **Purpose**: Kickoff ML pipeline on uploaded image.
- **Response** (200):
  ```json
  { "imageId": "uuid", "analysisResult": { "species": "Indian Pomfret", "measurements": {"weight_g": 342.3}, "qualityGrade": "Premium" } }
  ```

#### `GET /images`
- **Purpose**: Retrieve historical catches.
- **Query Params**: `limit` (int), `lastKey` (string)
- **Response** (200): Array of Catch Records containing `analysisResult` metrics.

#### `GET /analytics`
- **Purpose**: Retrieve summary aggregation data.
- **Response** (200): Includes `totalEarnings`, `avgWeight`, `totalCatches`, `speciesBreakdown` percentages, and `weeklyTrend` charts.

### Python AI Agent 

#### `POST /chat`
- **Purpose**: Process user query through Bedrock agent and tools.
- **Auth**: Yes (Bearer Token)
- **Request Body**: `{ "message": "What is the price of Mackerel in Mumbai?", "language": "hi" }`
- **Response** (200):
  ```json
  { "chatId": "conv-123", "response": "According to Sassoon Docks...", "timestamp": "2026-02-27T..." }
  ```

#### `GET /chat`
- **Purpose**: Fetch conversation history.
- **Query Params**: `limit`
- **Response** (200): Array of structured `{ role, message, response, timestamp }` chat pairs matching standard frontend display requirements.

---

## 🤖 7. AI/ML Model Documentation

### Models Overview
- **YOLOv11n (Nano)**: State-of-the-Art Object detection model. Locates the fish and references objects (e.g., Ruler, Hand) with sub-500ms latency.
- **EfficientNet-B0 / ViT**: Fish species classification and quality grading (detects cloudy eyes, discolored gills). Trained on custom dataset of 50+ regional fish species.
- **Mask R-CNN / SAM**: Generates pixel masks around fish body.
- **Depth-Anything-V2**: Advanced monocular depth estimator to establish volumetric Z-axis relationships.

### Inference Mathematics
Final metrics calculated scientifically using:
**Weight = a $\cdot$ L$^b$**
(Constants `a` and `b` derived from species databases. Length `L` determined by cross-referencing depth map pixel translation with reference objects inside the scene).

---

## 📱 8. Mobile Application Architecture (Expo)

### Navigation Structure (Tabs)
1. **Home/Dashboard**: Aggregate statistics and market alerts.
2. **Assistant**: Conversational interface mapping to Python LangGraph API.
3. **Upload (Center Floating)**: Hooks into device camera. Posts binary to S3 presigned URLs.
4. **Map**: Geolocation markers representing past catches.
5. **Settings**: Language preferences (hooked to i18next).

### Features
- Data fetching occurs via custom `api-client.ts`, dynamically routing local development to computer IPs, and staging to API Gateway.
- AsyncStorage caches tokens and handles offline fallback via `mock-api.ts`.
- Multi-lingual string localization via `i18n.ts`.

---

## 🗂 9. Folder Structure

```text
/
├── agent/                # Python GenAI Logic (LangGraph + Bedrock)
│   ├── src/core/         # State graph definitions and Prompts
│   ├── src/tools/        # External tool integration (Weather, Market)
│   └── src/memory/       # DynamoDB Conversation threading
├── backend/              # Node.js Serverless Platform
│   └── src/functions/    # Logic for Presigning, Analyzing, Aggregation
├── frontend/             # Next.js Web Application
│   └── src/              # Pages, App Router, React Components
├── mobile/               # Expo React Native App
│   └── app/(tabs)/       # Screen routing
└── infrastructure/       # AWS IAM Policies and DynamoDB Table Shapes
```

---

## ☁ 10. Deployment Architecture

- **Web Hosting**: AWS Amplify (CDN + CI/CD automated).
- **Backend APIs**: AWS Lambda with Amazon API Gateway acting as reverse-proxy and authorization point.
- **AI Agent**: Deployed as AWS Lambda utilizing Mangum adapter to run FastAPI serverless. 
- **Model Hosting**: Amazon SageMaker Multi-Model Endpoints (MME) to cost-share GPU instance profiles behind auto-scalers.

---

## 🔐 11. Security Considerations

- **Authentication**: Amazon Cognito secures both APIs via JWT Bearer Tokens.
- **Storage**: Amazon S3 buckets are strictly private. Uploads mediated entirely via short-lived Presigned URLs bound to the requesting user's ID.
- **Data Encapsulation**: DynamoDB tables utilize Partition Keys enforcing user access isolation (`userId = :uid`).
- **Secrets**: API Keys (Bedrock, OpenWeather) managed inside AWS Secrets Manager, injected to Lambda at run-time.

---

## 🚀 12. Performance & Scalability Strategy

- **Lazy Loading**: React Components load maps/charts dynamically.
- **Database Scalability**: DynamoDB scales horizontally with On-Demand Capacity billing.
- **Caching**: Local caching configured via service workers and AsyncStorage on mobile to mitigate API calls on weak 3G ocean networks.
- **Asynchronous AI**: Computer vision runs asynchronously. Clients submit to queue and get polling pointers, preventing API timeouts for heavier model invocations.

---

## 🧪 13. Testing Strategy

- **API Tests**: Validated utilizing `httpx` smoke test scripts checking the entire RAG pipeline functionality using specific multi-lingual prompts.
- **Web App**: Unit testing over custom UI Components. 
- **Mobile Environment**: Validated using Metro Bundler bridging device emulators seamlessly into the host network.

---

## 🛠 14. Setup & Installation Guide

### Prerequisites
- Node.js 20+ & Python 3.12+
- Expo CLI
- AWS Account configured with Bedrock Access

### Environment Setup
1. **Agent**:
   ```bash
   cd agent && pip install -r requirements.txt
   uvicorn src.main:app --port 8001
   ```
2. **Frontend**:
   ```bash
   cd frontend && npm install
   npm run dev
   ```
3. **Mobile**:
   ```bash
   cd mobile && npm install
   npx expo start -c
   ```

### Core External Keys
- `AWS_REGION`
- `BEDROCK_MODEL_ID` (e.g. `us.anthropic.claude-sonnet-4-6-20250514-v1:0`)
- `OPENWEATHERMAP_API_KEY`
- `DYNAMODB_IMAGES_TABLE`
- `NEXT_PUBLIC_AGENT_URL` / `EXPO_PUBLIC_AGENT_URL`
