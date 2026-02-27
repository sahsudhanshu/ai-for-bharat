# from ultralytics import YOLO
# import os

# # -------- CONFIG --------
# YOLO_PT_PATH = "detection.pt"   # your trained YOLO weights
# EXPORT_DIR = "exports"
# IMG_SIZE = 256              # same as training
# QUANTIZE = "int8"               # options: "int8", "fp16", None

# os.makedirs(EXPORT_DIR, exist_ok=True)

# # -------- LOAD MODEL --------
# model = YOLO(YOLO_PT_PATH)

# # -------- EXPORT --------
# model.export(
#     format="tflite",
#     imgsz=IMG_SIZE,
#     int8=(QUANTIZE == "int8"),
#     half=(QUANTIZE == "fp16"),
#     device="cpu",
#     optimize=True,
#     simplify=True
# )

# print("✅ YOLO exported to TFLite successfully")
import cv2
import numpy as np
import tensorflow as tf

# -------- CONFIG --------
TFLITE_MODEL = "detection_saved_model\detection_int8.tflite"
IMAGE_PATH = "static/crops/6d60e250-e8f9-499b-9614-a0978554d1b0_5.jpg"
IMG_SIZE = 256;  
CONF_THRESHOLD = 0.25

# -------- LOAD MODEL --------
interpreter = tf.lite.Interpreter(model_path=TFLITE_MODEL)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# -------- PREPROCESS --------
img = cv2.imread(IMAGE_PATH)
h, w, _ = img.shape

img_resized = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
img_norm = img_rgb.astype(np.float32) / 255.0
input_tensor = np.expand_dims(img_norm, axis=0)

interpreter.set_tensor(input_details[0]["index"], input_tensor)

# -------- INFERENCE --------
interpreter.invoke()
output = interpreter.get_tensor(output_details[0]["index"])

# -------- POSTPROCESS (YOLO-style) --------
for det in output[0]:
    conf = det[4]
    if conf < CONF_THRESHOLD:
        continue
    print(det)
    x, y, bw, bh = det[:4]
    x1 = int((x - bw / 2) * w)
    y1 = int((y - bh / 2) * h)
    x2 = int((x + bw / 2) * w)
    y2 = int((y + bh / 2) * h)

    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.putText(img, f"{conf:.2f}", (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

cv2.imshow("YOLO TFLite Output", img)
cv2.waitKey(0)
cv2.destroyAllWindows()