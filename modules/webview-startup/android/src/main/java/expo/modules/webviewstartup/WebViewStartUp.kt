package expo.modules.webviewstartup

import android.app.Application
import androidx.annotation.OptIn
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewStartUpConfig
import java.util.concurrent.Executor
import java.util.concurrent.Executors

/**
 * Runs as much of Chromium's browser process startup as possible before the first `<WebView>` is
 * mounted, so that the mount does not pay for it on the UI thread.
 */
object WebViewStartUp {
  private val executor: Executor = Executors.newSingleThreadExecutor { Thread(it, "webview-startup") }

  @JvmStatic
  @OptIn(markerClass = [WebViewCompat.ExperimentalAsyncStartUp::class])
  fun warmUp(application: Application) {
    val config = WebViewStartUpConfig.Builder(ignoreFailures(executor))
      // UI-thread startup tasks end in WebSettings.getDefaultUserAgent, which crashes on some
      // Samsung WebView builds when it runs off the UI thread (b/406701301).
      .setShouldRunUiThreadStartUpTasks(false)
      .build()

    try {
      WebViewCompat.startUpWebView(application.applicationContext, config, WebViewCompat.WebViewStartUpCallback {})
    } catch (throwable: Throwable) {
      // Best effort: a failed warm-up leaves the first WebView mount to start up as it does today.
    }
  }

  private fun ignoreFailures(executor: Executor): Executor = Executor { command ->
    executor.execute {
      try {
        command.run()
      } catch (throwable: Throwable) {
        // This runs on our own thread, where an escaped exception would kill the process.
      }
    }
  }
}