package expo.modules.webviewstartup;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mockStatic;

import android.app.Application;
import android.content.Context;
import android.os.Looper;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewStartUpConfig;
import expo.modules.core.interfaces.ApplicationLifecycleListener;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {24, 34})
@LooperMode(LooperMode.Mode.PAUSED)
public class WebViewStartUpTest {
  private Application application;
  private MockedStatic<WebViewCompat> webViewCompat;

  @Before
  public void setUp() {
    application = RuntimeEnvironment.getApplication();
    webViewCompat = mockStatic(WebViewCompat.class);
  }

  @After
  public void tearDown() {
    webViewCompat.close();
  }

  private WebViewStartUpConfig startUpFrom(Application target) {
    WebViewStartUp.warmUp(target);

    ArgumentCaptor<WebViewStartUpConfig> config = ArgumentCaptor.forClass(WebViewStartUpConfig.class);
    webViewCompat.verify(() -> WebViewCompat.startUpWebView(any(Context.class), config.capture(), any()));
    return config.getValue();
  }

  @Test
  public void startsWebViewStartUpOnItsOwnThread() throws Exception {
    WebViewStartUpConfig config = startUpFrom(application);

    AtomicReference<Thread> thread = new AtomicReference<>();
    CountDownLatch ran = new CountDownLatch(1);
    config.getBackgroundExecutor().execute(() -> {
      thread.set(Thread.currentThread());
      ran.countDown();
    });

    assertTrue(ran.await(5, TimeUnit.SECONDS));
    assertNotEquals(Looper.getMainLooper().getThread(), thread.get());
  }

  @Test
  public void skipsTheUiThreadStartUpTasksThatCrashOffTheMainThread() {
    assertFalse(startUpFrom(application).shouldRunUiThreadStartUpTasks());
  }

  @Test
  public void swallowsFailuresAndKeepsTheExecutorUsable() throws Exception {
    AtomicReference<Throwable> escaped = new AtomicReference<>();
    Thread.UncaughtExceptionHandler previousHandler = Thread.getDefaultUncaughtExceptionHandler();
    Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> escaped.set(throwable));
    try {
      WebViewStartUpConfig config = startUpFrom(application);

      config.getBackgroundExecutor().execute(() -> {
        throw new IllegalStateException("WebView providers can fail on their own thread");
      });

      CountDownLatch afterFailure = new CountDownLatch(1);
      config.getBackgroundExecutor().execute(afterFailure::countDown);
      assertTrue(afterFailure.await(5, TimeUnit.SECONDS));
      Thread.sleep(200);

      assertNull("a failure on the startup thread must not escape it", escaped.get());
    } finally {
      Thread.setDefaultUncaughtExceptionHandler(previousHandler);
    }
  }

  @Test
  public void survivesAStartUpCallThatThrows() {
    webViewCompat.when(() -> WebViewCompat.startUpWebView(any(Context.class), any(), any()))
        .thenThrow(new IllegalStateException("unsupported WebView"));

    WebViewStartUp.warmUp(application);
  }

  @Test
  public void listenerWarmsUpWhenTheApplicationIsCreated() {
    new WebViewStartUpListener().onCreate(application);

    webViewCompat.verify(() -> WebViewCompat.startUpWebView(any(Context.class), any(), any()));
  }

  @Test
  public void packageRegistersTheListenerWithExpo() {
    List<ApplicationLifecycleListener> listeners =
        new WebViewStartUpPackage().createApplicationLifecycleListeners(application);

    assertEquals(1, listeners.size());
    assertTrue(listeners.get(0) instanceof WebViewStartUpListener);
  }
}