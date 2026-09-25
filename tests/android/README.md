# Native Android tests

## WebView startup

```sh
cd android
./gradlew -I ../tests/android/webview-startup-tests.gradle :webview-startup:testDebugUnitTest --no-daemon
```

These tests compile the local `webview-startup` module and run on Android API 24 and 34 with Robolectric. They verify that WebView startup is handed to a non-main thread, that UI-thread startup tasks are skipped, that a failure on the startup thread is swallowed and leaves the executor usable, that a throwing startup call does not escape, and that the Expo package registers the application lifecycle listener. UI-thread startup tasks are skipped deliberately: they end in `WebSettings.getDefaultUserAgent`, which crashes when it runs off the UI thread on some Samsung WebView builds (b/406701301), and the unguarded call is still present in androidx.webkit 1.14.0 and 1.17.0. These tests do not start a real Chromium process: WebView startup support is a property of the installed WebView APK, so an emulator or a physical device is what shows whether the main thread is still blocked.

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

## Enum prop conversion

```sh
cd android
./gradlew -I ../tests/android/enum-tests.gradle :expo-modules-core:testDebugUnitTest --no-daemon
```

These tests compile patched `expo-modules-core` and convert name-only, int, and string enum props on Android API 24 and 34. They also assert the converter class file does not reference `kotlin.reflect.full`. They do not prove ANR frequency on physical low-end devices.
