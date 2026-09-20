package expo.modules.webviewstartup

import android.app.Application
import expo.modules.core.interfaces.ApplicationLifecycleListener

class WebViewStartUpListener : ApplicationLifecycleListener {
  override fun onCreate(application: Application) {
    WebViewStartUp.warmUp(application)
  }
}