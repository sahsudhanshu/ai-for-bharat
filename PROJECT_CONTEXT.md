# 🐟 **COMPLETE PROJECT CONTEXT: AI-Powered Fisherman's Assistant**

## **📋 PROJECT OVERVIEW**

### **What This Project Is:**
An end-to-end AI-powered mobile and web application designed to help small-scale Indian fishermen maximize their income by:
1. **Scientifically analyzing fish catches** using computer vision (species, weight, quality)
2. **Providing intelligent market recommendations** using agentic AI
3. **Connecting fishermen with buyers** for better prices
4. **Supporting sustainable fishing** through regulatory compliance

### **The Core Problem Being Solved:**
- Fishermen can't accurately weigh fish on moving boats
- They lack real-time market information
- Middlemen exploit them with unfair prices
- No tools for sustainable fishing practices
- Poor business decisions lead to economic losses

---

## **🏗️ ARCHITECTURE OVERVIEW**

### **Technology Stack:**

**Frontend (Web):**
- Next.js 15.5.7 + React 19
- Tailwind CSS + Radix UI components
- Hosted on AWS Amplify
- PWA-enabled for offline functionality

**Mobile App:**
- Expo 54 + React Native 0.81.5
- Cross-platform (iOS/Android)
- Offline-first architecture
- Camera integration for fish capture

**Backend (Node.js):**
- AWS Lambda functions (Node.js 20.x)
- Express.js for local development
- Amazon API Gateway (REST)
- 18 Lambda functions handling:
  - Image upload/analysis
  - User management
  - Chat/AI agent integration
  - Analytics
  - Group analysis (batch processing)

**AI Agent (Python):**
- FastAPI + LangGraph
- Google Gemini (gemini-3-flash-preview) as LLM
- Amazon Bedrock (Claude Sonnet) as fallback
- Conversational memory with DynamoDB
- 7 tools for external data:
  - Weather data
  - Catch history
  - Market prices
  - Map data
  - Group analysis

**ML Pipeline:**
- YOLOv11 for fish detection
- EfficientNet/ViT for species classification
- Depth Anything V2 for 3D estimation
- Mask R-CNN for segmentation
- Currently using Hugging Face Space: `kyanmahajan-fish-pred.hf.space`

**Databases:**
- Amazon DynamoDB (5 tables):
  - `ai-bharat-images` (catch records)
  - `ai-bharat-groups` (batch analysis)
  - `ai-bharat-chats` (chat history)
  - `ai-bharat-users` (user profiles)
  - `ai-bharat-conversations` (agent memory)
  - `ai-bharat-messages` (message history)
  - `ai-bharat-memory` (long-term memory)

**Storage:**
- Amazon S3: `fish-detection-project-2026`
- Stores raw images, processed results, analysis data

**Authentication:**
- Amazon Cognito User Pool: `ap-south-1_YkvAmWJfC`
- JWT-based authentication
- Email/phone number login

---

## **📁 PROJECT STRUCTURE**

```
ai-for-bharat/
├── frontend/              # Next.js web application
│   ├── src/app/          # App router pages
│   │   ├── analytics/    # Analytics dashboard
│   │   ├── chatbot/      # AI chat interface
│   │   ├── history/      # Catch history
│   │   ├── upload/       # Single image upload
│   │   ├── upload-group/ # Batch upload
│   │   ├── profile/      # User profile
│   │   └── settings/     # Settings
│   ├── src/components/   # Reusable components
│   ├── src/lib/          # Utilities & API client
│   └── src/hooks/        # Custom React hooks
│
├── mobile/               # Expo React Native app
│   ├── app/(tabs)/       # Tab navigation
│   │   ├── index.tsx     # Home/Dashboard
│   │   ├── upload.tsx    # Camera capture
│   │   ├── chat.tsx      # AI assistant
│   │   ├── history.tsx   # Catch history
│   │   ├── map.tsx       # Map view
│   │   ├── analytics.tsx # Analytics
│   │   └── settings.tsx  # Settings
│   ├── components/       # React Native components
│   ├── lib/              # API client & utilities
│   └── __tests__/        # Test files (73 tests)
│
├── backend/              # Node.js Lambda backend
│   ├── src/functions/    # 18 Lambda functions
│   │   ├── getPresignedUrl.js      # S3 upload URLs
│   │   ├── analyzeImage.js         # Trigger ML analysis
│   │   ├── getImages.js            # Fetch catch history
│   │   ├── getAnalytics.js         # Aggregate stats
│   │   ├── sendChat.js             # AI chat proxy
│   │   ├── getChatHistory.js       # Chat history
│   │   ├── getUserProfile.js       # User data
│   │   ├── updateUserProfile.js    # Update profile
│   │   ├── deleteUserAccount.js    # Account deletion
│   │   ├── exportUserData.js       # Data export
│   │   ├── getMapData.js           # Map markers
│   │   ├── createGroupPresignedUrls.js  # Batch upload
│   │   ├── analyzeGroup.js         # Batch analysis
│   │   ├── getGroups.js            # Group history
│   │   ├── getGroupDetails.js      # Group details
│   │   ├── deleteGroup.js          # Delete group
│   │   ├── tts.js                  # Text-to-speech
│   │   └── preSignUpAutoConfirm.js # Auto-confirm users
│   └── src/utils/        # Shared utilities
│
├── agent/                # Python AI agent
│   ├── src/core/         # LangGraph orchestration
│   │   ├── graph.py      # Agent workflow
│   │   ├── state.py      # State management
│   │   └── prompts.py    # System prompts
│   ├── src/tools/        # External integrations
│   │   ├── weather.py    # Weather API
│   │   ├── catch_history.py  # Catch data
│   │   ├── market_prices.py  # Market data
│   │   ├── map_data.py   # Location data
│   │   └── specific_catch.py # Catch details
│   ├── src/memory/       # Conversation memory
│   │   ├── manager.py    # Memory orchestration
│   │   └── dynamodb_store.py  # DynamoDB ops
│   ├── src/routes/       # API routes
│   └── src/telegram/     # Telegram bot integration
│
├── ML/                   # Machine learning models
│   ├── detection.pt      # YOLOv11 weights
│   ├── Fish.pth          # Classification model
│   ├── Fish_disease.pth  # Disease detection
│   ├── detection.onnx    # ONNX format
│   └── render.py         # Inference script
│
└── infrastructure/       # AWS infrastructure
    ├── dynamodb-tables.json  # Table schemas
    ├── iam-policies.json     # IAM permissions
    └── README.md             # Deployment guide
```

---

## **🔄 COMPLETE DATA FLOW**

### **1. Image Analysis Flow:**
```
User captures fish photo (Mobile/Web)
    ↓
Frontend requests presigned S3 URL
    ↓
Backend Lambda generates presigned URL
    ↓
Frontend uploads image directly to S3
    ↓
Frontend triggers analysis (POST /images/{id}/analyze)
    ↓
Backend Lambda calls ML API (Hugging Face)
    ↓
ML API returns:
    - Species identification
    - Weight estimation
    - Quality grade
    - Bounding boxes
    ↓
Backend saves results to DynamoDB
    ↓
Frontend polls/receives results
    ↓
User sees analysis on screen
```

### **2. AI Chat Flow:**
```
User asks question in local language
    ↓
Frontend sends to backend (POST /chat)
    ↓
Backend proxies to Python agent (POST /chat)
    ↓
Agent (LangGraph):
    1. Language validation
    2. Load conversation memory
    3. Load long-term user memory
    4. Invoke LLM (Gemini/Claude)
    5. Execute tool calls if needed:
       - get_weather()
       - get_catch_history()
       - get_market_prices()
       - get_map_data()
    6. Generate response
    7. Update memory
    ↓
Response streamed back to frontend
    ↓
User sees AI response
```

### **3. Group Analysis Flow:**
```
User uploads multiple fish images
    ↓
Frontend requests batch presigned URLs
    ↓
Backend generates URLs for each image
    ↓
Frontend uploads all images to S3
    ↓
Frontend triggers group analysis
    ↓
Backend processes each image through ML API
    ↓
Backend aggregates results:
    - Total fish count
    - Species distribution
    - Total weight
    - Average quality
    - Total estimated value
    ↓
Results saved to DynamoDB (groups table)
    ↓
User sees aggregate analysis
```

---

## **🗄️ DATABASE SCHEMA**

### **DynamoDB Tables:**

**1. ai-bharat-images**
```javascript
{
  imageId: "uuid",              // Partition Key
  userId: "cognito-sub",        // GSI Partition Key
  createdAt: "ISO timestamp",   // GSI Sort Key
  status: "processing|completed|failed",
  s3Path: "s3://bucket/key",
  location: {
    latitude: 19.0760,
    longitude: 72.8777,
    region: "Mumbai"
  },
  analysisResult: {
    species: "Indian Pomfret",
    scientificName: "Pampus argenteus",
    measurements: {
      length_mm: 185.3,
      weight_g: 342.7,
      confidence: 0.94
    },
    qualityGrade: "Premium",
    marketEstimate: {
      price_per_kg: 800,
      estimated_value: 274.16
    }
  }
}
```

**2. ai-bharat-groups**
```javascript
{
  groupId: "uuid",              // Partition Key
  userId: "cognito-sub",        // GSI Partition Key
  createdAt: "ISO timestamp",   // GSI Sort Key
  imageCount: 5,
  status: "processing|completed|failed",
  presignedViewUrls: ["url1", "url2"],
  analysisResult: {
    aggregateStats: {
      totalFishCount: 12,
      totalEstimatedWeight: 4.5,  // kg
      totalEstimatedValue: 3600,  // INR
      speciesDistribution: {
        "Pomfret": 5,
        "Mackerel": 7
      }
    },
    individualResults: [...]
  }
}
```

**3. ai-bharat-chats**
```javascript
{
  chatId: "uuid",               // Partition Key
  userId: "cognito-sub",        // GSI Partition Key
  timestamp: "ISO timestamp",   // GSI Sort Key
  message: "What's the weather?",
  response: "Current conditions...",
  language: "en"
}
```

**4. ai-bharat-users**
```javascript
{
  userId: "cognito-sub",        // Partition Key
  email: "user@example.com",
  phoneNumber: "+91...",
  name: "Fisherman Name",
  region: "Mumbai",
  preferredLanguage: "hi",
  createdAt: "ISO timestamp",
  statistics: {
    totalCatches: 150,
    totalEarnings: 45000,
    averageQuality: 0.85
  }
}
```

**5. ai-bharat-conversations** (Agent memory)
```javascript
{
  conversationId: "uuid",       // Partition Key
  userId: "cognito-sub",
  summary: "User asked about...",
  createdAt: "ISO timestamp",
  lastUpdatedAt: "ISO timestamp"
}
```

---

## **🔌 API ENDPOINTS**

### **Backend API (Node.js Lambda):**

**Authentication:**
- All endpoints require JWT token in `Authorization: Bearer <token>` header
- Token obtained from Cognito after login

**Image Management:**
```
POST   /images/presigned-url          # Get S3 upload URL
POST   /images/{imageId}/analyze      # Trigger ML analysis
GET    /images                        # List user's catches
GET    /images/{imageId}              # Get specific catch
DELETE /images/{imageId}              # Delete catch
```

**Group Analysis:**
```
POST   /groups/presigned-urls         # Get batch upload URLs
POST   /groups/{groupId}/analyze      # Trigger batch analysis
GET    /groups                        # List user's groups
GET    /groups/{groupId}              # Get group details
DELETE /groups/{groupId}              # Delete group
```

**Chat/AI:**
```
POST   /chat                          # Send message to AI
GET    /chat                          # Get chat history
POST   /tts                           # Text-to-speech
```

**User Management:**
```
GET    /profile                       # Get user profile
PUT    /profile                       # Update profile
DELETE /account                       # Delete account
GET    /export                        # Export user data
```

**Analytics:**
```
GET    /analytics                     # Get aggregate stats
GET    /map                           # Get map markers
```

### **Agent API (Python FastAPI):**

```
POST   /chat                          # Main chat endpoint
GET    /chat                          # Chat history
GET    /health                        # Health check
```

---

## **🤖 AI AGENT ARCHITECTURE**

### **LangGraph Workflow:**
```
User Input
    ↓
language_guard (validate language)
    ↓
load_context (memory + location)
    ↓
agent (LLM invocation)
    ↓
tool_executor (if tools needed)
    ↓ (loop back to agent)
memory_update (save conversation)
    ↓
Response
```

### **Available Tools:**
1. **get_weather(lat, lon)** - Marine weather conditions
2. **get_catch_history(user_id, limit)** - User's past catches
3. **get_catch_details(image_id, user_id)** - Specific catch info
4. **get_map_data(user_id)** - Location markers
5. **get_market_prices(port, species)** - Fish prices
6. **get_group_history(user_id, limit)** - Batch analysis history
7. **get_group_details(group_id, user_id)** - Group details

### **Memory System:**
- **Short-term:** Last 10 messages verbatim
- **Long-term:** Extracted facts about user (home port, preferences, etc.)
- **Summary:** Older conversations summarized by LLM

---

## **🔐 SECURITY & AUTHENTICATION**

### **Amazon Cognito Setup:**
- User Pool ID: `ap-south-1_YkvAmWJfC`
- Client ID: `3pi3304ng9e5kuqloirqodmthd`
- Region: `ap-south-1` (Mumbai)
- Auto-confirm users (no email verification)
- Password policy: 8+ chars, lowercase + numbers

### **JWT Flow:**
```
User logs in → Cognito issues JWT → Frontend stores token
    ↓
Every API call includes: Authorization: Bearer <token>
    ↓
Backend verifies JWT with Cognito
    ↓
Extracts userId from token
    ↓
Authorizes access to user's data only
```

---

## **🌍 MULTI-LANGUAGE SUPPORT**

**Supported Languages:**
- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Malayalam (ml)
- Kannada (kn)
- Bengali (bn)
- Marathi (mr)
- Gujarati (gu)
- Odia (or)

**Implementation:**
- Frontend: i18next for translations
- Agent: Language validation + multi-lingual prompts
- Voice: AWS Polly for TTS in regional languages

---

## **📊 CURRENT STATUS**

### **What's Working:**
✅ User authentication (Cognito)
✅ Image upload to S3
✅ ML analysis (via Hugging Face)
✅ Catch history & analytics
✅ Group/batch analysis
✅ AI chat with memory
✅ Map visualization
✅ Multi-language support
✅ Mobile app (iOS/Android)
✅ Web app (responsive)
✅ Offline functionality (mobile)
✅ **API error handling with toast notifications (just fixed!)**

### **What's Pending:**
⏳ Real-time market price integration (using mock data)
⏳ WhatsApp Business integration
⏳ SageMaker deployment (currently using HF Space)
⏳ Production AWS deployment
⏳ Regulatory compliance checking

---

## **🚀 DEPLOYMENT STATUS**

### **Current Environment:**
- **Development mode** - all services running locally
- Backend: `localhost:3005`
- Agent: `localhost:8001`
- Frontend: `localhost:3000`
- Mobile: Expo dev server

### **AWS Resources (Configured):**
- Cognito User Pool ✅
- S3 Bucket ✅
- DynamoDB Tables ✅
- Lambda Functions (not deployed yet)
- API Gateway (not deployed yet)
- Amplify (not deployed yet)

---
