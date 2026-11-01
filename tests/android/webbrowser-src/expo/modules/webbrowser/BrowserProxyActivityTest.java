package expo.modules.webbrowser;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {Build.VERSION_CODES.N, Build.VERSION_CODES.UPSIDE_DOWN_CAKE}, shadows = {TestCustomTabsIntentShadow.class})
public class BrowserProxyActivityTest {
  private static final String URL = "https://example.com/login";

  @After
  public void resetShadow() {
    TestCustomTabsIntentShadow.nextFailure = null;
    TestCustomTabsIntentShadow.lastLaunchedUrl = null;
  }

  private BrowserProxyActivity launch() {
    Intent intent = new Intent(RuntimeEnvironment.getApplication(), BrowserProxyActivity.class);
    intent.putExtra(BrowserProxyActivity.EXTRA_URL, URL);
    intent.putExtra(BrowserProxyActivity.EXTRA_CUSTOM_TABS_INTENT_DATA, new Intent(Intent.ACTION_VIEW, Uri.parse(URL)));
    return Robolectric.buildActivity(BrowserProxyActivity.class, intent).setup().get();
  }

  @Test
  public void finishesInsteadOfCrashingWhenTheTargetIsNotExported() {
    TestCustomTabsIntentShadow.nextFailure = new SecurityException("Permission Denial: starting Intent not exported from uid 10195");

    assertTrue(launch().isFinishing());
  }

  @Test
  public void finishesInsteadOfCrashingWhenTheTargetCannotBeResolved() {
    TestCustomTabsIntentShadow.nextFailure = new ActivityNotFoundException("No Activity found to handle Intent");

    assertTrue(launch().isFinishing());
  }

  @Test
  public void staysAliveWhenTheTargetLaunches() {
    BrowserProxyActivity activity = launch();

    assertEquals(Uri.parse(URL), TestCustomTabsIntentShadow.lastLaunchedUrl);
    assertFalse(activity.isFinishing());
  }
}
