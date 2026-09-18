# Native PDF tests

After installing dependencies and generating the Android project, run:

```sh
cd android
./gradlew -I ../tests/android/pdf-tests.gradle :react-native-pdf:testDebugUnitTest --no-daemon
```

The tests compile the patched `react-native-pdf` module and execute its `PdfView.recycle()` override with AndroidPdfViewer's rendering handler. Robolectric supplies Android's message queue. The tests control document rendering through a mock `PdfFile` and replace Pdfium initialization with a shadow.

The tests verify disposal order, queued-task removal, detachment, interruption, and renderer shutdown. They do not execute PDFium's C++ renderer. Physical-device stress testing still verifies the native crash and teardown latency.

The Android CI workflow runs these tests before building the app. Gradle writes results under `node_modules/react-native-pdf/android/build/reports/tests/testDebugUnitTest`.
