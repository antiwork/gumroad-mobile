package expo.modules.webviewstartup

import android.app.Application
import androidx.annotation.OptIn
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewStartUpConfig
import java.util.concurrent.Executor
import java.util.concurrent.Executors

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
    }
  }

  private fun ignoreFailures(executor: Executor): Executor = Executor { command ->
    executor.execute {
      try {
        command.run()
      } catch (throwable: Throwable) {
      }
    }
  }
}