from onnx_tf.backend import prepare
import tensorflow as tf

# Load ONNX model
onnx_model_path = "fish.onnx"
tf_model_path = "fish_tf"

onnx_model = onnx.load(onnx_model_path)
tf_rep = prepare(onnx_model)

# Export TensorFlow SavedModel
tf_rep.export_graph(tf_model_path)

print("✅ TensorFlow model saved")