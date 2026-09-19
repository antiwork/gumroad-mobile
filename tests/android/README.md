# Native Android tests

## Image connectivity

```sh
cd android
./gradlew -I ../tests/android/image-tests.gradle :expo-image:testDebugUnitTest --no-daemon
```

These tests compile the patched Expo Image module and run on Android API 24 and 34 with Robolectric. They verify Glide module wiring, worker-thread registration/cleanup, main-thread reconnect notifications, lifecycle races, permission failure, and a blocked binder call. Android autolinking must keep `expo-image` in `buildFromSource`; otherwise Expo uses a precompiled artifact that omits the patch.

To verify real image retry, boot a local Android build, supply fixture product metadata with uncached HTTP thumbnails, and have the image server return 503. Keep the Products screen mounted, let the server return images again, then disconnect/reconnect the emulator network. Images must load without navigation, reload, or tapping Retry. Native tests do not prove ANR frequency on physical low-end devices.

## PDF teardown

After installing dependencies and generating the Android project, run:

```sh
cd android
./gradlew -I ../tests/android/pdf-tests.gradle :react-native-pdf:testDebugUnitTest --no-daemon
```

The tests compile the patched `react-native-pdf` module and execute its `PdfView.recycle()` override with AndroidPdfViewer's rendering handler. Robolectric supplies Android's message queue. The tests control document rendering through a mock `PdfFile` and replace Pdfium initialization with a shadow.

The tests verify disposal order, queued-task removal, detachment, interruption, and renderer shutdown. They do not execute PDFium's C++ renderer. Physical-device stress testing still verifies the native crash and teardown latency.

The Android CI workflow runs these tests before building the app. Gradle writes results under `node_modules/react-native-pdf/android/build/reports/tests/testDebugUnitTest`.
