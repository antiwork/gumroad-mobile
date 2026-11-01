package expo.modules.webbrowser;

import android.content.Context;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import org.robolectric.annotation.Implementation;
import org.robolectric.annotation.Implements;

@Implements(CustomTabsIntent.class)
public class TestCustomTabsIntentShadow {
  public static RuntimeException nextFailure;
  public static Uri lastLaunchedUrl;

  @Implementation
  protected void launchUrl(Context context, Uri url) {
    lastLaunchedUrl = url;
    if (nextFailure != null) {
      throw nextFailure;
    }
  }
}
