package expo.modules.webbrowser;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabsIntent;
import expo.modules.kotlin.AppContext;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {24, 34}, shadows = {TestCustomTabsIntentShadow.class})
public class CustomTabsActivitiesHelperTest {
  private static final String URL = "https://gumroad.com/login";

  private CustomTabsActivitiesHelper helper;

  @Before
  public void setUp() {
    AppContext appContext = mock(AppContext.class);
    when(appContext.getThrowingActivity()).thenReturn(Robolectric.buildActivity(Activity.class).setup().get());
    helper = new CustomTabsActivitiesHelper(appContext);
  }

  @After
  public void resetShadow() {
    TestCustomTabsIntentShadow.nextFailure = null;
    TestCustomTabsIntentShadow.lastLaunchedUrl = null;
  }

  private CustomTabsIntent tabsIntent() {
    CustomTabsIntent tabsIntent = new CustomTabsIntent.Builder().build();
    tabsIntent.intent.setData(Uri.parse(URL));
    return tabsIntent;
  }

  private OpenBrowserOptions options(boolean createTask, boolean useProxyActivity) {
    return new OpenBrowserOptions(null, null, null, false, false, false, false, createTask, useProxyActivity);
  }

  @Test
  public void rejectsWithAHandlerErrorWhenTheTargetIsNotExported() {
    TestCustomTabsIntentShadow.nextFailure = new SecurityException("Permission Denial: starting Intent not exported from uid 10195");

    expectHandlerError(options(false, true));
  }

  @Test
  public void rejectsWithAHandlerErrorWhenANewTaskTargetIsNotExported() {
    TestCustomTabsIntentShadow.nextFailure = new SecurityException("Permission Denial: starting Intent not exported from uid 10195");

    expectHandlerError(options(true, false));
  }

  @Test
  public void rejectsWithAHandlerErrorWhenTheTargetCannotBeResolved() {
    TestCustomTabsIntentShadow.nextFailure = new ActivityNotFoundException("No Activity found to handle Intent");

    expectHandlerError(options(false, true));
  }

  @Test
  public void launchesWhenTheTargetResolves() {
    helper.startCustomTabs(tabsIntent(), options(false, true));

    assertEquals(Uri.parse(URL), TestCustomTabsIntentShadow.lastLaunchedUrl);
  }

  private void expectHandlerError(OpenBrowserOptions options) {
    try {
      helper.startCustomTabs(tabsIntent(), options);
      fail("expected NoMatchingActivityException");
    } catch (NoMatchingActivityException expected) {
    }
  }
}
