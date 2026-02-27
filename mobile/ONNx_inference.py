# Load the exported TFLite model
from ultralytics import YOLO
import cv2
import matplotlib.pyplot as plt

# Load TFLite model
tflite_model = YOLO("/kaggle/input/models/knowledgelovers/quantized-yolos/pytorch/default/1/detection_float32.tflite")

# Run inference
results = tflite_model("/kaggle/input/datasets/knowledgelovers/fish-test/412YOMx098L._AC.jpg")

# Plot results (returns annotated image as numpy array, BGR)
annotated_img = results[0].plot()

# Convert BGR -> RGB for matplotlib
annotated_img = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)

# Show
plt.figure(figsize=(10, 6))
plt.imshow(annotated_img)
plt.axis("off")
plt.show()