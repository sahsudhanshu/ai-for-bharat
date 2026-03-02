# assets/models

This directory is intentionally empty in the source tree.

TFLite model files are **not** bundled with the app build.  
They live in the repository root [`models/`](../../models/) and must be
deployed to the device via ADB before the app can perform on-device inference.

See the [root README](../../README.md#deploying-models-to-device-adb) for
step-by-step ADB instructions.
