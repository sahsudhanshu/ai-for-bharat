# System Design Document: AI-Powered Fisherman's Assistant

## 1. Executive Summary

### 1.1 System Overview
The AI-Powered Fisherman's Assistant is a comprehensive mobile-first solution that transforms smartphones into precision instruments for fish analysis and intelligent business decision-making. The system combines cutting-edge computer vision, depth estimation, and agentic AI to deliver a "Perception-to-Profit" pipeline.

### 1.2 Design Philosophy
- **Mobile-First**: Optimized for smartphone usage in challenging maritime conditions
- **Edge-Cloud Hybrid**: Balance between on-device processing and cloud intelligence
- **Resilient Architecture**: Graceful degradation in low/no connectivity scenarios
- **User-Centric**: Designed for users with varying digital literacy levels
- **Scalable & Modular**: Built to grow from thousands to millions of users

### 1.3 Key Innovations
1. **Scientific Precision**: 90%+ weight accuracy from single 2D image
2. **Agentic Intelligence**: Autonomous decision support for market optimization
3. **Offline-First**: Core functionality without internet dependency
4. **Inclusive Design**: Multi-language, voice-enabled, low-literacy friendly

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            USER LAYER                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Fisherman (Web Browser - Mobile/Desktop)                              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER (Web UI)                                  │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │  Dashboard UI       │  │  Image Upload Module │  │  Analytics Module│   │
│  │  - Catch Overview   │  │  - Camera Capture    │  │  - Reports       │   │
│  │  - Market Insights  │  │  - File Upload       │  │  - Trends        │   │
│  │  - Quick Actions    │  │  - Preview           │  │  - Insights      │   │
│  └─────────────────────┘  └──────────────────────┘  └──────────────────┘   │
│                    React.js + Next.js (AWS Amplify)                          │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER (Cloud API)                                  │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐ │
│  │  Auth Service    │  │  Catch Management    │  │  Processing Service    │ │
│  │  - Cognito       │  │  Service             │  │  - Image Preprocessing │ │
│  │  - User Mgmt     │  │  - CRUD Operations   │  │  - Validation          │ │
│  │  - JWT Tokens    │  │  - Business Logic    │  │  - Queue Management    │ │
│  └──────────────────┘  └──────────────────────┘  └────────────────────────┘ │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Agentic Intelligence Service                                          │  │
│  │  - Market Analysis & Recommendations                                   │  │
│  │  - Buyer Matching & Negotiation Support                                │  │
│  │  - Route Optimization                                                  │  │
│  │  - Decision Orchestration (AWS Step Functions + Bedrock Agents)       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                    AWS Lambda + API Gateway + EventBridge                     │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AI/ML LAYER                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Detection   │→ │Classification│→ │ Segmentation │→ │    Metrics     │  │
│  │   Model      │  │    Model     │  │  + Depth     │  │  Calculator    │  │
│  │  (YOLOv11)   │  │ (EfficientNet│  │   Model      │  │  (W = a·L^b)   │  │
│  │              │  │  /ViT)       │  │ (Mask R-CNN/ │  │                │  │
│  │              │  │              │  │  Depth V2)   │  │                │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
│                    Amazon SageMaker Inference Endpoints                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CLOUD DATABASE LAYER                                   │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐ │
│  │ Catch Records DB │  │  Regional Cache DB   │  │     Users DB           │ │
│  │  - DynamoDB      │  │  - DynamoDB          │  │  - DynamoDB/Cognito    │ │
│  │  - Catch History │  │  - Market Prices     │  │  - Profiles            │ │
│  │  - Transactions  │  │  - Buyer Info        │  │  - Preferences         │ │
│  │  - Analytics     │  │  - Offline Cache     │  │  - Auth Data           │ │
│  └──────────────────┘  └──────────────────────┘  └────────────────────────┘ │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Media Storage (Amazon S3)                                             │  │
│  │  - Fish Images  - Analysis Results  - Reports  - Model Artifacts      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SERVICES                                     │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐ │
│  │ Market Price API │  │  Regional Density    │  │    Weather API         │ │
│  │  - e-NAM         │  │  API                 │  │  - Marine Conditions   │ │
│  │  - Local Markets │  │  - Fishing Zones     │  │  - Forecasts           │ │
│  │  - Real-time     │  │  - Regulations       │  │  - Sea State           │ │
│  └──────────────────┘  └──────────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ DynamoDB     │  │ S3 Storage   │  │ Athena       │      │
│  │ (NoSQL)      │  │ (Media)      │  │ (Analytics)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                EXTERNAL INTEGRATIONS                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ e-NAM API    │  │ WhatsApp     │  │ Weather      │      │
│  │ Market Data  │  │ Business API │  │ Services     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Principles

#### 2.2.1 Layered Architecture
The system follows a clear separation of concerns across five distinct layers:

1. **User Layer**: Web browser interface for fishermen
2. **Frontend Layer**: React.js/Next.js UI components hosted on AWS Amplify
3. **Backend Layer**: Cloud API services for business logic and orchestration
4. **AI/ML Layer**: Sequential model pipeline for fish analysis
5. **Data Layer**: Cloud databases and external service integrations

#### 2.2.2 Sequential AI Pipeline
The AI/ML layer processes images through a sequential pipeline:
```
Detection → Classification → Segmentation + Depth → Metrics Calculation
```
Each stage feeds into the next, ensuring accurate and comprehensive analysis.

#### 2.2.3 Service-Oriented Backend
Backend services are organized by function:
- **Auth Service**: User authentication and authorization (Cognito)
- **Catch Management Service**: CRUD operations for catch records
- **Processing Service**: Image preprocessing and validation
- **Agentic Intelligence Service**: Market analysis and decision support

#### 2.2.4 Multi-Tier Data Storage
- **Catch Records DB**: Primary transactional data (DynamoDB)
- **Regional Cache DB**: Cached market prices and buyer info for offline access
- **Users DB**: User profiles and preferences
- **Media Storage**: S3 for images and analysis results

#### 2.2.5 External Integration Layer
Separate layer for third-party services:
- Market Price APIs (e-NAM, local markets)
- Regional Density APIs (fishing zones, regulations)
- Weather APIs (marine conditions, forecasts)

## 3. Component Design

### 3.1 Frontend Layer (Web UI)

#### 3.1.1 Technology Stack
- **Framework**: React.js 18+ with Next.js 14+
- **Hosting**: AWS Amplify (CI/CD, hosting, CDN)
- **State Management**: React Context + Zustand
- **UI Components**: Custom components + Tailwind CSS
- **PWA**: Service Workers for offline capability
- **Authentication**: AWS Amplify Auth (Cognito integration)

#### 3.1.2 Core Modules

**1. Dashboard UI Module**
```javascript
Components:
- CatchOverview: Summary of today's catches
- MarketInsights: Real-time price trends and recommendations
- QuickActions: Fast access to camera, history, buyers
- EarningsTracker: Daily/weekly/monthly income visualization
- NotificationCenter: Alerts and updates

Features:
- Responsive grid layout
- Real-time data updates via API polling
- Offline-first with cached data
- Voice navigation support
```

**2. Image Upload Module**
```javascript
Components:
- CameraCapture: Direct camera access with preview
- FileUpload: Drag-drop or browse for images
- ImagePreview: Review before submission
- CaptureGuidance: Visual hints for optimal photos
- ReferenceObjectDetection: Optional calibration

Features:
- Auto-focus and exposure control
- Image compression (max 2MB)
- Motion blur detection
- Multi-image batch upload
- Progress indicators
```

**3. Analytics Module**
```javascript
Components:
- ReportsViewer: Daily/weekly/monthly reports
- TrendsChart: Catch composition and pricing trends
- InsightCards: AI-generated recommendations
- ComparisonView: Performance vs. community averages
- ExportOptions: PDF/CSV download

Features:
- Interactive charts (Chart.js/Recharts)
- Date range filtering
- Species-wise breakdown
- Income projections
```

#### 3.1.3 Supporting Modules

**Offline Storage Module**
```javascript
// IndexedDB for local data persistence
Stores:
- recentCatches: Last 50 catch records
- marketPrices: Cached prices (updated every 6 hours)
- userPreferences: Settings and language
- pendingUploads: Queue for offline captures
- buyerContacts: Frequently contacted buyers
```

**Voice Interface Module**
```javascript
// Web Speech API + AWS Transcribe/Polly fallback
Features:
- Voice commands in 10+ regional languages
- Text-to-speech for results
- Hands-free operation mode
- Wake word detection ("Hey Fisher")
```

**Localization Module**
```javascript
// i18next for multi-language support
Supported Languages:
- Hindi, Tamil, Telugu, Malayalam, Kannada
- Bengali, Marathi, Gujarati, Odia, Assamese
- English (fallback)

Features:
- Dynamic language switching
- RTL support where needed
- Cultural date/number formatting
- Voice output in selected language
```

#### 3.1.4 User Interface Design

**Main Screens**
1. **Home/Dashboard**: Quick stats, recent catches, market trends
2. **Camera Capture**: Simple capture interface with guidance
3. **Analysis Results**: Fish details, weight, quality, price estimate
4. **Market Intelligence**: Comparison of selling options
5. **Buyer Connection**: Chat/negotiate with buyers
6. **History**: Past catches and earnings
7. **Profile/Settings**: Language, preferences, help

**Design Principles**
- Large touch targets (min 48x48px)
- High contrast for sunlight visibility
- Minimal text, maximum icons
- Progressive disclosure of information
- Haptic feedback for confirmations

### 3.2 Backend Layer (Cloud API)

#### 3.2.1 Technology Stack
- **API Gateway**: Amazon API Gateway (REST + WebSocket)
- **Compute**: AWS Lambda (Node.js 20.x / Python 3.12)
- **Orchestration**: AWS Step Functions
- **Event Bus**: Amazon EventBridge
- **Authentication**: Amazon Cognito
- **Secrets**: AWS Secrets Manager

#### 3.2.2 Core Services

**1. Auth Service**
```python
# Amazon Cognito Integration
Components:
- User Registration & Login
- JWT Token Management
- Multi-factor Authentication (SMS)
- Password Reset & Recovery
- Session Management

Endpoints:
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
```

**2. Catch Management Service**
```python
# CRUD Operations for Catch Records
Components:
- Create Catch Record
- Update Catch Details
- Retrieve Catch History
- Delete Catch Record
- Batch Operations

Endpoints:
POST /catches
GET /catches/{id}
GET /catches/user/{userId}
PUT /catches/{id}
DELETE /catches/{id}
GET /catches/analytics

Business Logic:
- Validation of catch data
- Automatic timestamp and geolocation
- Species verification against database
- Legal size compliance checking
- Income calculation and tracking
```

**3. Processing Service**
```python
# Image Preprocessing and Validation
Components:
- Image Upload Handler
- Format Validation (JPEG, PNG, HEIC)
- Size Optimization (resize, compress)
- Queue Management (SQS)
- Error Handling & Retry Logic

Workflow:
1. Receive image from frontend
2. Validate format and size
3. Upload to S3 (raw images bucket)
4. Trigger AI/ML pipeline via EventBridge
5. Return processing job ID
6. Poll for results or WebSocket notification

Endpoints:
POST /process/upload
GET /process/status/{jobId}
POST /process/batch
```

**4. Agentic Intelligence Service**
```python
# Market Analysis and Decision Support
Components:
- Market Data Aggregator
- Option Evaluator
- Recommendation Engine
- Buyer Matcher
- Negotiation Assistant

Powered by:
- AWS Step Functions (workflow orchestration)
- Amazon Bedrock (LLM reasoning)
- Bedrock Agents (autonomous actions)

Workflow (Step Functions):
1. Fetch real-time market prices
2. Calculate transport costs
3. Estimate freshness degradation
4. Evaluate weather risks
5. Generate ranked recommendations
6. Match with suitable buyers
7. Initiate negotiation support

Endpoints:
POST /intelligence/analyze
GET /intelligence/recommendations/{catchId}
POST /intelligence/connect-buyer
GET /intelligence/market-trends
```

### 3.3 AI/ML Layer (Sequential Pipeline)

#### 3.3.1 Pipeline Architecture

The AI/ML layer processes images through a sequential four-stage pipeline, where each model's output feeds into the next stage:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Detection  │ -> │Classification│ -> │Segmentation │ -> │   Metrics   │
│   Model     │    │    Model    │    │  + Depth    │    │ Calculator  │
│  (YOLOv11)  │    │(EfficientNet│    │   Model     │    │ (W = a·L^b) │
│             │    │    /ViT)    │    │(Mask R-CNN/ │    │             │
│             │    │             │    │  Depth V2)  │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     |                   |                   |                   |
  Bounding           Species            Precise            Weight &
   Boxes            Identification      Boundaries         Measurements
```

#### 3.3.2 Stage 1: Detection Model (YOLOv11)

**Purpose**: Locate and detect fish in the image

**Model Specifications**
```yaml
Model: YOLOv11n (nano variant for speed)
Input: 640x640 RGB image
Output: Bounding boxes + confidence scores
Classes: 
  - 50+ fish species
  - Reference objects (ruler, hand, coin)
Backbone: CSPDarknet with C2f modules
Inference Time: <500ms on SageMaker ml.g4dn.xlarge
Accuracy: mAP@0.5 > 0.92
```

**Preprocessing**
```python
def preprocess_image(image):
    # Resize to 640x640
    image = cv2.resize(image, (640, 640))
    # Normalize pixel values
    image = image / 255.0
    # Convert to tensor
    return torch.from_numpy(image).permute(2, 0, 1)
```

**Output Format**
```json
{
  "detections": [
    {
      "bbox": [x1, y1, x2, y2],
      "confidence": 0.94,
      "class": "pomfret",
      "class_id": 12
    }
  ]
}
```

#### 3.3.3 Stage 2: Classification Model (EfficientNet/ViT)

**Purpose**: Identify exact species and assess quality

**Model Specifications**
```yaml
Model: EfficientNet-B0 (or Vision Transformer Tiny)
Input: 224x224 RGB (cropped from detection bbox)
Output: Species class + quality grade
Classes: 50+ Indian fish species
Training: Transfer learning on custom fish dataset
Accuracy: >95% top-1 accuracy
Inference Time: <300ms
```

**Species Database**
```python
SPECIES_DATABASE = {
    "pomfret": {
        "scientific_name": "Pampus argenteus",
        "common_names": ["White Pomfret", "Paplet"],
        "length_weight_params": {"a": 0.0182, "b": 3.12},
        "min_legal_size_mm": 150,
        "market_grade_factors": ["size", "freshness", "damage"]
    },
    "mackerel": {
        "scientific_name": "Rastrelliger kanagurta",
        "common_names": ["Indian Mackerel", "Bangda"],
        "length_weight_params": {"a": 0.0089, "b": 3.05},
        "min_legal_size_mm": 180,
        "market_grade_factors": ["size", "freshness", "body_firmness"]
    }
    # ... 48+ more species
}
```

**Quality Grading**
```python
def assess_quality(image, species):
    features = extract_quality_features(image)
    # Eye clarity, gill color, skin texture, body firmness
    quality_score = quality_model.predict(features)
    
    if quality_score > 0.8:
        return "Premium"
    elif quality_score > 0.6:
        return "Standard"
    else:
        return "Low"
```

**Output Format**
```json
{
  "species": "pomfret",
  "scientific_name": "Pampus argenteus",
  "confidence": 0.96,
  "quality_grade": "Premium",
  "quality_score": 0.87,
  "quality_factors": {
    "eye_clarity": 0.92,
    "gill_color": 0.85,
    "skin_texture": 0.84
  }
}
```

#### 3.3.4 Stage 3: Segmentation + Depth Model

**Purpose**: Extract precise fish boundaries and estimate 3D geometry

**Segmentation Model**
```yaml
Model: Mask R-CNN or SAM (Segment Anything Model)
Input: Original image + detection bbox
Output: Pixel-level segmentation mask
Accuracy: IoU > 0.85
Inference Time: <600ms
```

**Depth Estimation Model**
```yaml
Model: Depth-Anything-V2-Small
Input: 518x518 RGB image
Output: Relative depth map (H x W)
Purpose: 3D geometry reconstruction
Inference Time: <800ms
Calibration: Reference object or statistical average
```

**Combined Processing**
```python
def segment_and_estimate_depth(image, bbox, species):
    # Step 1: Segment fish from background
    mask = segmentation_model.predict(image, bbox)
    
    # Step 2: Generate depth map
    depth_map = depth_model.predict(image)
    
    # Step 3: Apply mask to depth map
    fish_depth = depth_map * mask
    
    # Step 4: Extract 3D point cloud
    point_cloud = generate_point_cloud(mask, fish_depth)
    
    # Step 5: Calculate volume
    volume = estimate_volume(point_cloud)
    
    return {
        "mask": mask,
        "depth_map": fish_depth,
        "volume_cm3": volume,
        "point_cloud": point_cloud
    }
```

**Reference Object Calibration**
```python
def calibrate_with_reference(image, detections):
    # Detect reference object (ruler, coin, hand)
    ref_objects = [d for d in detections if d['class'] in REFERENCE_OBJECTS]
    
    if ref_objects:
        ref = ref_objects[0]
        known_size = REFERENCE_SIZES[ref['class']]  # e.g., 1cm coin
        pixel_size = calculate_pixel_size(ref['bbox'])
        scale_factor = known_size / pixel_size
        return scale_factor
    else:
        # Use statistical average for species
        return get_average_scale_factor(species)
```

**Output Format**
```json
{
  "segmentation_mask": "base64_encoded_mask",
  "depth_map": "base64_encoded_depth",
  "volume_cm3": 245.7,
  "scale_factor": 0.85,
  "calibration_method": "reference_object"
}
```

#### 3.3.5 Stage 4: Metrics Calculator

**Purpose**: Calculate accurate weight and measurements using biological formulas

**Length-Weight Relationship**
```python
def calculate_weight(length_mm, species):
    """
    W = a * L^b
    where:
    W = weight in grams
    L = length in mm
    a, b = species-specific constants
    """
    params = SPECIES_DATABASE[species]["length_weight_params"]
    a = params["a"]
    b = params["b"]
    
    weight_g = a * (length_mm ** b)
    return weight_g

def extract_length_from_segmentation(mask, depth_map, scale_factor):
    # Find longest axis of fish
    contours = cv2.findContours(mask)
    longest_contour = max(contours, key=cv2.contourArea)
    
    # Calculate length using depth information
    length_pixels = calculate_geodesic_length(longest_contour, depth_map)
    length_mm = length_pixels * scale_factor
    
    return length_mm
```

**Comprehensive Metrics**
```python
def calculate_all_metrics(segmentation_data, species):
    length_mm = extract_length_from_segmentation(
        segmentation_data['mask'],
        segmentation_data['depth_map'],
        segmentation_data['scale_factor']
    )
    
    weight_g = calculate_weight(length_mm, species)
    
    # Additional measurements
    width_mm = calculate_width(segmentation_data['mask'])
    girth_mm = estimate_girth(segmentation_data['volume_cm3'], length_mm)
    
    # Confidence intervals
    weight_confidence = calculate_confidence_interval(
        weight_g, 
        segmentation_data['calibration_method']
    )
    
    # Legal compliance
    min_legal_size = SPECIES_DATABASE[species]["min_legal_size_mm"]
    is_legal = length_mm >= min_legal_size
    
    return {
        "length_mm": round(length_mm, 1),
        "weight_g": round(weight_g, 1),
        "width_mm": round(width_mm, 1),
        "girth_mm": round(girth_mm, 1),
        "weight_confidence_interval": weight_confidence,
        "is_legal_size": is_legal,
        "min_legal_size_mm": min_legal_size,
        "size_difference_mm": round(length_mm - min_legal_size, 1)
    }
```

**Final Output Format**
```json
{
  "analysis_id": "catch_20260215_123456",
  "timestamp": "2026-02-15T12:34:56Z",
  "species": "pomfret",
  "scientific_name": "Pampus argenteus",
  "quality_grade": "Premium",
  "measurements": {
    "length_mm": 185.3,
    "weight_g": 342.7,
    "width_mm": 78.2,
    "girth_mm": 156.4,
    "weight_confidence": {
      "lower": 308.4,
      "upper": 377.0,
      "accuracy": "90%"
    }
  },
  "compliance": {
    "is_legal_size": true,
    "min_legal_size_mm": 150,
    "size_difference_mm": 35.3
  },
  "market_estimate": {
    "price_per_kg": 450,
    "estimated_value": 154.22
  }
}
```

#### 3.3.6 Model Deployment on Amazon SageMaker

**Endpoint Configuration**
```python
# SageMaker Multi-Model Endpoint
endpoint_config = {
    "EndpointName": "fish-analysis-pipeline",
    "InstanceType": "ml.g4dn.xlarge",
    "InitialInstanceCount": 2,
    "AutoScaling": {
        "MinInstances": 2,
        "MaxInstances": 10,
        "TargetInvocations": 1000
    },
    "Models": [
        "yolov11-detection",
        "efficientnet-classification",
        "maskrcnn-segmentation",
        "depth-anything-v2",
        "metrics-calculator"
    ]
}
```

**Inference Pipeline**
```python
async def run_inference_pipeline(image_s3_uri):
    # Stage 1: Detection
    detections = await invoke_sagemaker_endpoint(
        "yolov11-detection",
        {"image_uri": image_s3_uri}
    )
    
    # Stage 2: Classification
    classification = await invoke_sagemaker_endpoint(
        "efficientnet-classification",
        {
            "image_uri": image_s3_uri,
            "bbox": detections[0]['bbox']
        }
    )
    
    # Stage 3: Segmentation + Depth
    segmentation = await invoke_sagemaker_endpoint(
        "maskrcnn-segmentation",
        {
            "image_uri": image_s3_uri,
            "bbox": detections[0]['bbox']
        }
    )
    
    depth = await invoke_sagemaker_endpoint(
        "depth-anything-v2",
        {"image_uri": image_s3_uri}
    )
    
    # Stage 4: Metrics Calculation
    metrics = calculate_all_metrics(
        {**segmentation, "depth_map": depth},
        classification['species']
    )
    
    return {
        **classification,
        **metrics,
        "detection_confidence": detections[0]['confidence']
    }
```


### 3.4 Cloud Database Layer

#### 3.4.1 Database Architecture

**1. Catch Records DB (Amazon DynamoDB)**
```python
Table: CatchRecords
Partition Key: userId (String)
Sort Key: timestamp (Number)

Attributes:
- catchId: UUID
- userId: String
- timestamp: Number (Unix timestamp)
- location: Map {latitude, longitude, region}
- species: String
- scientificName: String
- measurements: Map {length, weight, width, girth}
- qualityGrade: String
- qualityScore: Number
- isLegalSize: Boolean
- imageS3Uri: String
- analysisResultS3Uri: String
- marketValue: Number
- soldPrice: Number (optional)
- buyerId: String (optional)
- status: String (caught|listed|sold)

Indexes:
- GSI1: species-timestamp-index
- GSI2: status-timestamp-index
- GSI3: region-timestamp-index

Capacity:
- On-Demand pricing for variable workload
- Point-in-time recovery enabled
- TTL on old records (>2 years)
```

**2. Regional Cache DB (Amazon DynamoDB)**
```python
Table: RegionalCache
Partition Key: region (String)
Sort Key: dataType#timestamp (String)

Attributes:
- region: String (e.g., "mumbai", "kochi")
- dataType: String (market_price|buyer_info|weather)
- timestamp: Number
- data: Map (flexible structure)
- ttl: Number (expiration time)

Purpose:
- Cache market prices for offline access
- Store buyer information by region
- Cache weather forecasts
- Reduce API calls to external services

Update Frequency:
- Market prices: Every 30 minutes
- Buyer info: Daily
- Weather: Every 2 hours
```

**3. Users DB (Amazon DynamoDB + Cognito)**
```python
Table: Users
Partition Key: userId (String)

Attributes:
- userId: String (Cognito sub)
- phoneNumber: String
- name: String
- region: String
- preferredLanguage: String
- registrationDate: Number
- lastLoginDate: Number
- preferences: Map {
    notifications: Boolean,
    voiceEnabled: Boolean,
    autoSync: Boolean
  }
- statistics: Map {
    totalCatches: Number,
    totalEarnings: Number,
    averageQuality: Number
  }
- verificationStatus: String
- subscriptionTier: String (free|premium)

Integration:
- Amazon Cognito for authentication
- DynamoDB for extended profile data
- Sync on login/profile update
```

**4. Buyers DB (Amazon DynamoDB)**
```python
Table: Buyers
Partition Key: buyerId (String)

Attributes:
- buyerId: UUID
- businessName: String
- contactPerson: String
- phoneNumber: String
- whatsappNumber: String
- region: String
- preferredSpecies: List[String]
- rating: Number (1-5)
- totalTransactions: Number
- verificationStatus: String
- priceHistory: List[Map]

GSI:
- region-rating-index for buyer matching
```

#### 3.4.2 Media Storage (Amazon S3)

**Bucket Structure**
```
fish-analysis-media/
├── raw-images/
│   ├── {userId}/
│   │   └── {catchId}/
│   │       └── original.jpg
├── processed-images/
│   ├── {userId}/
│   │   └── {catchId}/
│   │       ├── annotated.jpg
│   │       ├── segmentation_mask.png
│   │       └── depth_map.png
├── analysis-results/
│   ├── {userId}/
│   │   └── {catchId}/
│   │       └── analysis.json
├── reports/
│   ├── {userId}/
│   │   ├── daily/
│   │   ├── weekly/
│   │   └── monthly/
└── model-artifacts/
    ├── yolov11/
    ├── efficientnet/
    ├── maskrcnn/
    └── depth-anything-v2/
```

**S3 Configuration**
```yaml
Lifecycle Policies:
  - raw-images: Move to Glacier after 90 days
  - processed-images: Delete after 30 days
  - analysis-results: Retain indefinitely
  - reports: Move to Glacier after 180 days

Security:
  - Encryption: AES-256 (SSE-S3)
  - Access: IAM roles + pre-signed URLs
  - Versioning: Enabled for analysis-results

Performance:
  - Transfer Acceleration: Enabled
  - CloudFront CDN: For image delivery
```

#### 3.4.3 Analytics (Amazon Athena)

**Purpose**: Query historical data for insights and reporting

**Athena Tables**
```sql
CREATE EXTERNAL TABLE catch_analytics (
    userId STRING,
    catchId STRING,
    timestamp BIGINT,
    species STRING,
    weight DOUBLE,
    qualityGrade STRING,
    marketValue DOUBLE,
    soldPrice DOUBLE,
    region STRING,
    year INT,
    month INT,
    day INT
)
PARTITIONED BY (year, month, day)
STORED AS PARQUET
LOCATION 's3://fish-analysis-analytics/catch-data/';

-- Example Queries
-- Average catch value by species
SELECT species, AVG(soldPrice) as avg_price
FROM catch_analytics
WHERE year = 2026 AND month = 2
GROUP BY species
ORDER BY avg_price DESC;

-- Top performing regions
SELECT region, SUM(soldPrice) as total_revenue
FROM catch_analytics
WHERE year = 2026
GROUP BY region
ORDER BY total_revenue DESC;
```

**Data Pipeline**
```
DynamoDB Streams → Lambda → S3 (Parquet) → Athena
```

### 3.5 External Data Services Integration

#### 3.5.1 Market Price API

**e-NAM Integration**
```python
class MarketPriceService:
    def __init__(self):
        self.enam_api_url = "https://api.enam.gov.in/v1"
        self.api_key = get_secret("enam_api_key")
    
    async def get_market_prices(self, species, region):
        """Fetch current market prices from e-NAM"""
        response = await http_client.get(
            f"{self.enam_api_url}/prices",
            params={
                "commodity": species,
                "market": region,
                "date": datetime.now().strftime("%Y-%m-%d")
            },
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        
        return {
            "species": species,
            "region": region,
            "price_per_kg": response['modal_price'],
            "min_price": response['min_price'],
            "max_price": response['max_price'],
            "timestamp": response['timestamp']
        }
    
    async def get_nearby_markets(self, latitude, longitude, radius_km=50):
        """Find markets within radius"""
        response = await http_client.get(
            f"{self.enam_api_url}/markets/nearby",
            params={
                "lat": latitude,
                "lon": longitude,
                "radius": radius_km
            }
        )
        return response['markets']
```

**Local Market APIs**
```python
# Integration with regional fish market APIs
LOCAL_MARKET_APIS = {
    "mumbai": "https://api.mumbai-fish-market.in",
    "kochi": "https://api.kochi-marine-market.in",
    "chennai": "https://api.chennai-fish-market.in",
    "visakhapatnam": "https://api.vizag-fishing-harbor.in"
}

async def aggregate_market_prices(species, region):
    """Aggregate prices from multiple sources"""
    prices = []
    
    # e-NAM
    enam_price = await get_enam_price(species, region)
    prices.append(enam_price)
    
    # Local market API
    if region in LOCAL_MARKET_APIS:
        local_price = await get_local_market_price(species, region)
        prices.append(local_price)
    
    # Calculate weighted average
    avg_price = calculate_weighted_average(prices)
    
    return {
        "average_price": avg_price,
        "price_range": {
            "min": min(p['price'] for p in prices),
            "max": max(p['price'] for p in prices)
        },
        "sources": prices
    }
```

#### 3.5.2 Regional Density API

**Fishing Zones & Regulations**
```python
class RegionalDensityService:
    def __init__(self):
        self.api_url = "https://api.fisheries.gov.in/v1"
        self.api_key = get_secret("fisheries_api_key")
    
    async def get_fishing_zone_info(self, latitude, longitude):
        """Get fishing zone and regulations"""
        response = await http_client.get(
            f"{self.api_url}/zones/lookup",
            params={"lat": latitude, "lon": longitude}
        )
        
        return {
            "zone_id": response['zone_id'],
            "zone_name": response['zone_name'],
            "regulations": response['regulations'],
            "protected_species": response['protected_species'],
            "seasonal_restrictions": response['seasonal_restrictions'],
            "recommended_practices": response['recommended_practices']
        }
    
    async def check_species_legality(self, species, location, size_mm):
        """Check if catch is legal"""
        zone_info = await self.get_fishing_zone_info(
            location['latitude'],
            location['longitude']
        )
        
        # Check protected species
        if species in zone_info['protected_species']:
            return {
                "is_legal": False,
                "reason": "Protected species in this zone"
            }
        
        # Check size restrictions
        min_size = zone_info['regulations'].get(species, {}).get('min_size')
        if min_size and size_mm < min_size:
            return {
                "is_legal": False,
                "reason": f"Below minimum size ({min_size}mm)"
            }
        
        return {"is_legal": True}
```

#### 3.5.3 Weather API

**Marine Weather Integration**
```python
class WeatherService:
    def __init__(self):
        self.api_url = "https://api.openweathermap.org/data/2.5"
        self.marine_api_url = "https://api.stormglass.io/v2"
        self.api_key = get_secret("weather_api_key")
    
    async def get_marine_conditions(self, latitude, longitude):
        """Get current and forecast marine conditions"""
        # Current conditions
        current = await http_client.get(
            f"{self.marine_api_url}/weather/point",
            params={
                "lat": latitude,
                "lng": longitude,
                "params": "waveHeight,windSpeed,seaLevel,waterTemperature"
            }
        )
        
        # 3-day forecast
        forecast = await http_client.get(
            f"{self.marine_api_url}/weather/forecast",
            params={
                "lat": latitude,
                "lng": longitude,
                "params": "waveHeight,windSpeed"
            }
        )
        
        return {
            "current": {
                "wave_height_m": current['waveHeight'],
                "wind_speed_ms": current['windSpeed'],
                "water_temp_c": current['waterTemperature'],
                "sea_level_m": current['seaLevel']
            },
            "forecast": forecast['hours'][:72],  # 3 days
            "warnings": self.extract_warnings(current, forecast)
        }
    
    def extract_warnings(self, current, forecast):
        """Extract weather warnings"""
        warnings = []
        
        if current['waveHeight'] > 3.0:
            warnings.append("High waves - rough sea conditions")
        
        if current['windSpeed'] > 15:
            warnings.append("Strong winds - exercise caution")
        
        # Check forecast for deteriorating conditions
        for hour in forecast['hours'][:24]:
            if hour['waveHeight'] > 4.0:
                warnings.append("Severe weather expected in next 24 hours")
                break
        
        return warnings
    
    async def calculate_freshness_risk(self, current_location, destination, 
                                      catch_time, transport_mode="road"):
        """Calculate risk of fish spoilage during transport"""
        weather = await self.get_marine_conditions(
            current_location['latitude'],
            current_location['longitude']
        )
        
        # Calculate travel time
        travel_time_hours = calculate_travel_time(
            current_location,
            destination,
            transport_mode
        )
        
        # Assess temperature risk
        avg_temp = weather['current']['water_temp_c']
        if avg_temp > 25:
            risk_factor = 1.5
        elif avg_temp > 20:
            risk_factor = 1.2
        else:
            risk_factor = 1.0
        
        # Calculate freshness degradation
        time_since_catch = (datetime.now() - catch_time).total_seconds() / 3600
        total_time = time_since_catch + travel_time_hours
        
        freshness_score = 100 - (total_time * risk_factor * 2)
        
        return {
            "freshness_score": max(0, freshness_score),
            "risk_level": "high" if freshness_score < 60 else "medium" if freshness_score < 80 else "low",
            "estimated_arrival_freshness": max(0, freshness_score),
            "recommendations": self.get_freshness_recommendations(freshness_score)
        }
```



### 3.6 Agentic Intelligence Service (The Brain)

#### 3.6.1 AWS Step Functions Orchestration

**Decision Workflow State Machine**
```json
{
  "Comment": "Fish Selling Decision Workflow",
  "StartAt": "FetchCatchData",
  "States": {
    "FetchCatchData": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:GetCatchData",
      "Next": "ParallelDataGathering"
    },
    "ParallelDataGathering": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "FetchMarketPrices",
          "States": {
            "FetchMarketPrices": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:region:account:function:GetMarketPrices",
              "End": true
            }
          }
        },
        {
          "StartAt": "FetchWeatherData",
          "States": {
            "FetchWeatherData": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:region:account:function:GetWeatherData",
              "End": true
            }
          }
        },
        {
          "StartAt": "FetchNearbyBuyers",
          "States": {
            "FetchNearbyBuyers": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:region:account:function:GetNearbyBuyers",
              "End": true
            }
          }
        }
      ],
      "Next": "EvaluateOptions"
    },
    "EvaluateOptions": {
      "Type": "Task",
      "Resource": "arn:aws:states:::bedrock:invokeModel",
      "Parameters": {
        "ModelId": "anthropic.claude-3-sonnet",
        "Body": {
          "prompt": "Analyze selling options and rank by profitability",
          "context.$": "$"
        }
      },
      "Next": "GenerateRecommendations"
    },
    "GenerateRecommendations": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:GenerateRecommendations",
      "Next": "MatchBuyers"
    },
    "MatchBuyers": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:MatchBuyers",
      "Next": "SendNotifications"
    },
    "SendNotifications": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:SendNotifications",
      "End": true
    }
  }
}
```

#### 3.6.2 Amazon Bedrock Integration

**LLM-Powered Market Analysis**
```python
class BedrockMarketAnalyzer:
    def __init__(self):
        self.bedrock = boto3.client('bedrock-runtime')
        self.model_id = "anthropic.claude-3-sonnet-20240229-v1:0"
    
    async def analyze_selling_options(self, catch_data, market_data, 
                                     weather_data, buyer_data):
        """Use LLM to analyze and rank selling options"""
        
        prompt = f"""
        You are an expert fish market analyst helping a fisherman maximize profit.
        
        Catch Details:
        - Species: {catch_data['species']}
        - Weight: {catch_data['weight_g']}g
        - Quality: {catch_data['quality_grade']}
        - Current Location: {catch_data['location']}
        - Time Caught: {catch_data['timestamp']}
        
        Market Options:
        {json.dumps(market_data, indent=2)}
        
        Weather Conditions:
        {json.dumps(weather_data, indent=2)}
        
        Available Buyers:
        {json.dumps(buyer_data, indent=2)}
        
        Analyze each selling option considering:
        1. Net profit (price - fuel cost - transport cost)
        2. Freshness risk during transport
        3. Weather conditions and travel safety
        4. Buyer reliability and payment terms
        5. Time to reach market
        
        Provide:
        1. Ranked list of options (best to worst)
        2. Expected profit for each option
        3. Risk assessment for each option
        4. Specific recommendation with reasoning
        
        Format as JSON.
        """
        
        response = self.bedrock.invoke_model(
            modelId=self.model_id,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        result = json.loads(response['body'].read())
        analysis = json.loads(result['content'][0]['text'])
        
        return analysis
```

**Bedrock Agent for Buyer Negotiation**
```python
class NegotiationAgent:
    def __init__(self):
        self.bedrock_agent = boto3.client('bedrock-agent-runtime')
        self.agent_id = "AGENT_ID"
        self.agent_alias_id = "AGENT_ALIAS_ID"
    
    async def negotiate_with_buyer(self, catch_data, buyer_data, 
                                   market_analysis):
        """AI agent to assist in price negotiation"""
        
        session_state = {
            "catch_details": catch_data,
            "buyer_profile": buyer_data,
            "market_analysis": market_analysis,
            "target_price": market_analysis['recommended_price'],
            "minimum_acceptable_price": market_analysis['min_price']
        }
        
        # Start negotiation session
        response = self.bedrock_agent.invoke_agent(
            agentId=self.agent_id,
            agentAliasId=self.agent_alias_id,
            sessionId=f"negotiation_{catch_data['catchId']}",
            inputText=f"Initiate negotiation for {catch_data['species']} "
                     f"with buyer {buyer_data['businessName']}",
            sessionState=session_state
        )
        
        return {
            "negotiation_id": response['sessionId'],
            "initial_offer": response['output']['text'],
            "strategy": response['sessionState']['strategy']
        }
    
    async def handle_buyer_response(self, negotiation_id, buyer_message):
        """Process buyer's counter-offer"""
        response = self.bedrock_agent.invoke_agent(
            agentId=self.agent_id,
            agentAliasId=self.agent_alias_id,
            sessionId=negotiation_id,
            inputText=buyer_message
        )
        
        return {
            "agent_response": response['output']['text'],
            "recommendation": response['sessionState']['recommendation'],
            "should_accept": response['sessionState']['should_accept']
        }
```

#### 3.6.3 Decision Support Logic

**Option Evaluation Algorithm**
```python
class SellingOptionEvaluator:
    def __init__(self):
        self.market_service = MarketPriceService()
        self.weather_service = WeatherService()
        self.fuel_cost_per_km = 8.0  # INR
    
    async def evaluate_all_options(self, catch_data, current_location):
        """Evaluate all possible selling options"""
        
        # Get nearby markets
        markets = await self.market_service.get_nearby_markets(
            current_location['latitude'],
            current_location['longitude'],
            radius_km=100
        )
        
        options = []
        
        for market in markets:
            option = await self.evaluate_single_option(
                catch_data,
                current_location,
                market
            )
            options.append(option)
        
        # Sort by net profit
        options.sort(key=lambda x: x['net_profit'], reverse=True)
        
        return options
    
    async def evaluate_single_option(self, catch_data, current_location, 
                                    market):
        """Evaluate a single selling option"""
        
        # Calculate distance and travel time
        distance_km = calculate_distance(
            current_location,
            market['location']
        )
        travel_time_hours = distance_km / 40  # Assume 40 km/h average
        
        # Get market price
        price_data = await self.market_service.get_market_prices(
            catch_data['species'],
            market['name']
        )
        
        # Calculate costs
        fuel_cost = distance_km * self.fuel_cost_per_km
        transport_cost = fuel_cost + (travel_time_hours * 50)  # Time cost
        
        # Calculate revenue
        weight_kg = catch_data['weight_g'] / 1000
        gross_revenue = weight_kg * price_data['price_per_kg']
        
        # Quality adjustment
        quality_multiplier = {
            "Premium": 1.2,
            "Standard": 1.0,
            "Low": 0.8
        }[catch_data['quality_grade']]
        
        adjusted_revenue = gross_revenue * quality_multiplier
        
        # Calculate freshness risk
        freshness_risk = await self.weather_service.calculate_freshness_risk(
            current_location,
            market['location'],
            catch_data['timestamp']
        )
        
        # Apply freshness penalty
        freshness_multiplier = freshness_risk['freshness_score'] / 100
        final_revenue = adjusted_revenue * freshness_multiplier
        
        # Net profit
        net_profit = final_revenue - transport_cost
        
        return {
            "market_name": market['name'],
            "market_location": market['location'],
            "distance_km": round(distance_km, 1),
            "travel_time_hours": round(travel_time_hours, 1),
            "price_per_kg": price_data['price_per_kg'],
            "gross_revenue": round(gross_revenue, 2),
            "transport_cost": round(transport_cost, 2),
            "net_profit": round(net_profit, 2),
            "freshness_score": freshness_risk['freshness_score'],
            "risk_level": freshness_risk['risk_level'],
            "recommendation_score": self.calculate_recommendation_score(
                net_profit,
                freshness_risk['freshness_score'],
                distance_km
            )
        }
    
    def calculate_recommendation_score(self, net_profit, freshness_score, 
                                      distance_km):
        """Calculate overall recommendation score (0-100)"""
        # Weighted scoring
        profit_score = min(100, (net_profit / 500) * 100)  # Normalize
        freshness_weight = freshness_score
        distance_score = max(0, 100 - distance_km)  # Closer is better
        
        overall_score = (
            profit_score * 0.5 +
            freshness_weight * 0.3 +
            distance_score * 0.2
        )
        
        return round(overall_score, 1)
```

#### 3.6.4 Buyer Matching Algorithm

```python
class BuyerMatcher:
    def __init__(self):
        self.buyers_table = dynamodb.Table('Buyers')
    
    async def find_suitable_buyers(self, catch_data, market_location):
        """Find buyers interested in this catch"""
        
        # Query buyers in the region
        response = self.buyers_table.query(
            IndexName='region-rating-index',
            KeyConditionExpression='region = :region',
            FilterExpression='contains(preferredSpecies, :species)',
            ExpressionAttributeValues={
                ':region': market_location['region'],
                ':species': catch_data['species']
            }
        )
        
        buyers = response['Items']
        
        # Score and rank buyers
        scored_buyers = []
        for buyer in buyers:
            score = self.calculate_buyer_score(buyer, catch_data)
            scored_buyers.append({
                **buyer,
                "match_score": score
            })
        
        # Sort by match score
        scored_buyers.sort(key=lambda x: x['match_score'], reverse=True)
        
        return scored_buyers[:5]  # Top 5 matches
    
    def calculate_buyer_score(self, buyer, catch_data):
        """Calculate buyer match score"""
        score = 0
        
        # Rating (0-50 points)
        score += buyer['rating'] * 10
        
        # Transaction history (0-30 points)
        if buyer['totalTransactions'] > 100:
            score += 30
        elif buyer['totalTransactions'] > 50:
            score += 20
        elif buyer['totalTransactions'] > 10:
            score += 10
        
        # Species preference (0-20 points)
        if catch_data['species'] in buyer['preferredSpecies']:
            score += 20
        
        return score
```

## 4. Data Flow Diagrams

### 4.1 Image Analysis Flow

```
User Captures Image
        ↓
Frontend: Image Upload Module
        ↓
API Gateway: POST /process/upload
        ↓
Lambda: Processing Service
        ↓
S3: Store Raw Image
        ↓
EventBridge: Trigger AI Pipeline
        ↓
SageMaker: Detection Model (YOLOv11)
        ↓
SageMaker: Classification Model (EfficientNet)
        ↓
SageMaker: Segmentation + Depth Model
        ↓
Lambda: Metrics Calculator
        ↓
DynamoDB: Store Catch Record
        ↓
S3: Store Analysis Results
        ↓
API Gateway: WebSocket Notification
        ↓
Frontend: Display Results
```

### 4.2 Market Intelligence Flow

```
User Requests Recommendations
        ↓
API Gateway: POST /intelligence/analyze
        ↓
Step Functions: Start Workflow
        ↓
Parallel Execution:
  ├─ Lambda: Fetch Market Prices (e-NAM API)
  ├─ Lambda: Fetch Weather Data
  └─ Lambda: Fetch Nearby Buyers
        ↓
Bedrock: Analyze Options (LLM)
        ↓
Lambda: Generate Recommendations
        ↓
Lambda: Match Buyers
        ↓
DynamoDB: Cache Results
        ↓
SNS: Send Notifications
        ↓
Frontend: Display Recommendations
```

## 5. Security Architecture

### 5.1 Authentication & Authorization

**Amazon Cognito Configuration**
```yaml
UserPool:
  MfaConfiguration: OPTIONAL
  PasswordPolicy:
    MinimumLength: 8
    RequireUppercase: false
    RequireLowercase: true
    RequireNumbers: true
    RequireSymbols: false
  
  AccountRecoverySetting:
    - Name: verified_phone_number
      Priority: 1
  
  Schema:
    - Name: phone_number
      Required: true
    - Name: preferred_language
      Required: true
    - Name: region
      Required: true

IdentityPool:
  AllowUnauthenticatedIdentities: false
  
  Roles:
    Authenticated: FishermanRole
    Unauthenticated: None
```

**IAM Roles**
```yaml
FishermanRole:
  Policies:
    - S3Access:
        - s3:PutObject (own folder only)
        - s3:GetObject (own folder only)
    - DynamoDBAccess:
        - dynamodb:PutItem (CatchRecords)
        - dynamodb:Query (own records)
        - dynamodb:GetItem (own records)
    - APIGatewayAccess:
        - execute-api:Invoke (all endpoints)
```

### 5.2 Data Encryption

- **In Transit**: TLS 1.3 for all API calls
- **At Rest**: 
  - S3: AES-256 encryption
  - DynamoDB: AWS managed encryption
  - Secrets Manager: KMS encryption

### 5.3 API Security

```yaml
APIGateway:
  Throttling:
    RateLimit: 1000 requests/second
    BurstLimit: 2000 requests/second
  
  Authorization:
    Type: Cognito User Pool
    Scopes: [read, write, admin]
  
  CORS:
    AllowOrigins: [https://app.fisherai.com]
    AllowMethods: [GET, POST, PUT, DELETE]
    AllowHeaders: [Authorization, Content-Type]
```

## 6. Deployment Architecture

### 6.1 AWS Amplify Deployment

```yaml
Frontend:
  Framework: Next.js 14
  Hosting: AWS Amplify
  
  Build Settings:
    NodeVersion: 20
    BuildCommand: npm run build
    OutputDirectory: .next
  
  Environment Variables:
    - NEXT_PUBLIC_API_URL
    - NEXT_PUBLIC_COGNITO_USER_POOL_ID
    - NEXT_PUBLIC_COGNITO_CLIENT_ID
    - NEXT_PUBLIC_REGION
  
  CDN:
    CloudFront: Enabled
    Caching: Aggressive for static assets
    Compression: Gzip + Brotli
```

### 6.2 Infrastructure as Code

**AWS CDK Stack**
```python
class FishAnalysisStack(Stack):
    def __init__(self, scope, id, **kwargs):
        super().__init__(scope, id, **kwargs)
        
        # Cognito User Pool
        user_pool = cognito.UserPool(self, "UserPool",
            user_pool_name="fisherman-users",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(
                phone=True
            ),
            mfa=cognito.Mfa.OPTIONAL
        )
        
        # DynamoDB Tables
        catch_table = dynamodb.Table(self, "CatchRecords",
            partition_key=dynamodb.Attribute(
                name="userId",
                type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="timestamp",
                type=dynamodb.AttributeType.NUMBER
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST
        )
        
        # S3 Buckets
        media_bucket = s3.Bucket(self, "MediaBucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            versioned=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    transitions=[
                        s3.Transition(
                            storage_class=s3.StorageClass.GLACIER,
                            transition_after=Duration.days(90)
                        )
                    ]
                )
            ]
        )
        
        # Lambda Functions
        processing_lambda = lambda_.Function(self, "ProcessingService",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="index.handler",
            code=lambda_.Code.from_asset("lambda/processing"),
            timeout=Duration.seconds(30),
            memory_size=1024
        )
        
        # API Gateway
        api = apigateway.RestApi(self, "FishAnalysisAPI",
            rest_api_name="Fish Analysis API",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=["https://app.fisherai.com"],
                allow_methods=["GET", "POST", "PUT", "DELETE"]
            )
        )
```

## 7. Monitoring & Observability

### 7.1 CloudWatch Dashboards

```yaml
Metrics:
  - API Latency (p50, p95, p99)
  - Error Rate (4xx, 5xx)
  - SageMaker Inference Time
  - DynamoDB Read/Write Capacity
  - Lambda Invocations & Duration
  - S3 Upload/Download Throughput

Alarms:
  - API Error Rate > 5%
  - SageMaker Inference Time > 3s
  - Lambda Errors > 10/minute
  - DynamoDB Throttling Events
```

### 7.2 Logging Strategy

```python
# Structured logging
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def log_event(event_type, data):
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "data": data,
        "request_id": context.aws_request_id
    }
    logger.info(json.dumps(log_entry))

# Example usage
log_event("catch_analyzed", {
    "catch_id": catch_id,
    "species": species,
    "inference_time_ms": inference_time,
    "accuracy": confidence_score
})
```

## 8. Cost Optimization

### 8.1 Estimated Monthly Costs (10,000 users)

```
AWS Amplify (Hosting): $50
API Gateway: $100
Lambda (Compute): $200
SageMaker (Inference): $800
DynamoDB: $150
S3 Storage: $100
CloudWatch: $50
Cognito: $50
Bedrock (LLM): $300
External APIs: $200
---
Total: ~$2,000/month
Cost per user: $0.20/month
```

### 8.2 Cost Optimization Strategies

1. **SageMaker**: Use multi-model endpoints, auto-scaling
2. **S3**: Lifecycle policies to move old data to Glacier
3. **DynamoDB**: On-demand pricing, TTL for old records
4. **Lambda**: Right-size memory, use provisioned concurrency sparingly
5. **API Gateway**: Cache responses, use WebSocket for real-time updates

---

**Document Version**: 1.0  
**Last Updated**: February 15, 2026  
**Status**: Ready for Implementation
