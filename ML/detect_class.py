import os
import uuid
import cv2
import torch
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

import torch.nn as nn
from torchvision import models, transforms
from ultralytics import YOLO

from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

# ---------------- CONFIG ----------------

STATIC_DIR = "static"
YOLO_OUT_DIR = os.path.join(STATIC_DIR, "yolo_outputs")
CROP_DIR = os.path.join(STATIC_DIR, "crops")
GRADCAM_DIR = os.path.join(STATIC_DIR, "gradcam")

os.makedirs(YOLO_OUT_DIR, exist_ok=True)
os.makedirs(CROP_DIR, exist_ok=True)
os.makedirs(GRADCAM_DIR, exist_ok=True)

YOLO_MODEL_PATH = "detection.pt"
RESNET_MODEL_PATH = "Fish.pth"

DEVICE = "cpu"

# Hyperparams (from training)
dropout = 0.3006558931441291

# ---------------- CLASS MAP ----------------

RESNET_LABELS = {
    0: "Bangus",
    1: "Big Head Carp",
    2: "Black Spotted Barb",
    3: "Catfish",
    4: "Climbing Perch",
    5: "Fourfinger Threadfin",
    6: "Freshwater Eel",
    7: "Glass Perchlet",
    8: "Goby",
    9: "Gold Fish",
    10: "Gourami",
    11: "Grass Carp",
    12: "Green Spotted Puffer",
    13: "Indian Carp",
    14: "Indo-Pacific Tarpon",
    15: "Jaguar Guapote",
    16: "Janitor Fish",
    17: "Knifefish",
    18: "Long-Snouted Pipefish",
    19: "Mosquito Fish",
    20: "Mudfish",
    21: "Mullet",
    22: "Pangasius",
    23: "Perch",
    24: "Scat Fish",
    25: "Silver Barb",
    26: "Silver Carp",
    27: "Silver Perch",
    28: "Snakehead",
    29: "Tenpounder",
    30: "Tilapia"
}

NUM_CLASSES = len(RESNET_LABELS)

# ---------------- APP ----------------

app = Flask(__name__, static_folder="static")
CORS(app)

# ---------------- LAZY MODELS ----------------

_models = {}

def get_yolo():
    if "yolo" not in _models:
        _models["yolo"] = YOLO(YOLO_MODEL_PATH)
    return _models["yolo"]

def get_resnet():
    if "resnet" not in _models:
        model = models.resnet18(weights=None)
        model.fc = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(model.fc.in_features, NUM_CLASSES)
        )
        model.load_state_dict(
            torch.load(RESNET_MODEL_PATH, map_location=DEVICE)
        )
        model.eval()
        _models["resnet"] = model
    return _models["resnet"]

# ---------------- TRANSFORMS ----------------

resnet_transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ---------------- HELPERS ----------------

def run_resnet(pil_img):
    model = get_resnet()
    x = resnet_transform(pil_img).unsqueeze(0)
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)
        conf, cls = torch.max(probs, 1)
    return int(cls.item()), float(conf.item())

def run_gradcam(pil_img, class_idx, image_id):
    model = get_resnet()

    input_tensor = resnet_transform(pil_img).unsqueeze(0)

    target_layers = [model.layer4[-1]]
    targets = [ClassifierOutputTarget(class_idx)]

    cam = GradCAM(
        model=model,
        target_layers=target_layers
    )

    grayscale_cam = cam(
        input_tensor=input_tensor,
        targets=targets
    )[0]

    rgb_img = np.array(pil_img).astype(np.float32) / 255.0
    rgb_img = cv2.resize(rgb_img, (256, 256))

    cam_image = show_cam_on_image(
        rgb_img,
        grayscale_cam,
        use_rgb=True
    )

    cam_name = f"{image_id}_gradcam.jpg"
    cam_path = os.path.join(GRADCAM_DIR, cam_name)

    cv2.imwrite(
        cam_path,
        cv2.cvtColor(cam_image, cv2.COLOR_RGB2BGR)
    )

    return f"/static/gradcam/{cam_name}"

# ---------------- ROUTES ----------------

@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    image_id = str(uuid.uuid4())
    file = request.files["image"]

    # Read image
    img_bytes = file.read()
    np_img = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    # YOLO inference
    yolo = get_yolo()
    results = yolo(img)[0]

    annotated_img = img.copy()
    crops_map = {}

    for i, box in enumerate(results.boxes):
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        yolo_conf = float(box.conf[0])
        yolo_cls = int(box.cls[0])

        crop = img[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        crop_name = f"{image_id}_{i}.jpg"
        crop_path = os.path.join(CROP_DIR, crop_name)
        cv2.imwrite(crop_path, crop)

        pil_crop = Image.fromarray(
            cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        )

        resnet_cls, resnet_conf = run_resnet(pil_crop)
        label_name = RESNET_LABELS.get(resnet_cls, "unknown")

        gradcam_url = run_gradcam(
            pil_crop,
            resnet_cls,
            f"{image_id}_{i}"
        )

        # Draw YOLO box
        cv2.rectangle(
            annotated_img,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

        crops_map[f"crop_{i}"] = {
            "bbox": [x1, y1, x2, y2],
            "yolo_class": yolo_cls,
            "yolo_confidence": yolo_conf,
            "resnet_label": label_name,
            "resnet_confidence": resnet_conf,
            "crop_url": f"/static/crops/{crop_name}",
            "gradcam_url": gradcam_url
        }

    # Save YOLO image
    yolo_img_name = f"{image_id}_yolo.jpg"
    yolo_img_path = os.path.join(YOLO_OUT_DIR, yolo_img_name)
    cv2.imwrite(yolo_img_path, annotated_img)

    return jsonify({
        "yolo_image_url": f"/static/yolo_outputs/{yolo_img_name}",
        "crops": crops_map
    })

# ---------------- MAIN ----------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7860)