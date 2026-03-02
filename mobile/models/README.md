# OceanAI – On-Device TFLite Models

These are the pre-trained TensorFlow Lite models used for **on-device** fish
analysis. They are checked into the repository so contributors can download
them without an extra build step.

> **Note:** Models are **not** bundled inside the Android/iOS app.  
> They must be deployed to the device manually using the ADB commands below
> before the app can run inference. See the [root README](../README.md) for
> the full setup guide.

## Models

| File                       | Size   | Purpose                            | Input                                            | Output                   |
| -------------------------- | ------ | ---------------------------------- | ------------------------------------------------ | ------------------------ |
| `detection_float32.tflite` | ~12 MB | Fish detection (YOLOv8/v11)        | `[1, 256, 256, 3]` float32 (RGB 0–1)             | `[1, 8, 1344]` float32   |
| `Fish.tflite`              | ~43 MB | Species classification (ResNet-18) | `[1, 224, 224, 3]` float32 (ImageNet normalised) | `[1, 31]` float32 logits |
| `Fish_disease.tflite`      | ~43 MB | Disease classification (ResNet-18) | `[1, 224, 224, 3]` float32 (ImageNet normalised) | `[1, 7]` float32 logits  |

## Class Labels

### Species (31 classes)

Bangus, Big Head Carp, Black Spotted Barb, Catfish, Climbing Perch,
Fourfinger Threadfin, Freshwater Eel, Glass Perchlet, Goby, Gold Fish,
Gourami, Grass Carp, Green Spotted Puffer, Indian Carp, Indo-Pacific Tarpon,
Jaguar Guapote, Janitor Fish, Knifefish, Long-Snouted Pipefish, Mosquito Fish,
Mudfish, Mullet, Pangasius, Perch, Scat Fish, Silver Barb, Silver Carp,
Silver Perch, Snakehead, Tenpounder, Tilapia

### Disease (7 classes)

Bacterial Red disease, Bacterial diseases (Aeromoniasis), Bacterial gill disease,
Fungal diseases (Saprolegniasis), Healthy Fish, Parasitic diseases,
Viral diseases (White tail disease)

## Quick ADB Deploy

```bash
# From the mobile/ directory:
npm run deploy-models

# Or manually (see scripts/deploy-models.sh for full script):
adb push models/detection_float32.tflite /sdcard/detection_float32.tflite
adb shell run-as com.aiforbharat.oceanai sh -c \
  'mkdir -p files/models && cp /sdcard/detection_float32.tflite files/models/ && rm /sdcard/detection_float32.tflite'
```
