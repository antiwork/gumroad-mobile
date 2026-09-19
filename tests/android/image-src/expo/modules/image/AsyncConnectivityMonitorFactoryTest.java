package expo.modules.image;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.robolectric.Shadows.shadowOf;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Looper;
import com.bumptech.glide.GlideBuilder;
import com.bumptech.glide.manager.ConnectivityMonitor;
import com.bumptech.glide.manager.ConnectivityMonitorFactory;
import java.util.ArrayDeque;
import java.util.Queue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.ArgumentCaptor;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {24, 34})
@LooperMode(LooperMode.Mode.PAUSED)
public class AsyncConnectivityMonitorFactoryTest {
  private final Queue<Runnable> tasks = new ArrayDeque<>();
  private final Context context = mock(Context.class);
  private final ConnectivityManager manager = mock(ConnectivityManager.class);
  private final ConnectivityMonitor.ConnectivityListener listener = mock(ConnectivityMonitor.ConnectivityListener.class);
  private ConnectivityMonitor monitor;

  @Before
  public void setUp() {
    when(context.getApplicationContext()).thenReturn(context);
    when(context.checkPermission(eq(Manifest.permission.ACCESS_NETWORK_STATE), anyInt(), anyInt()))
        .thenReturn(PackageManager.PERMISSION_GRANTED);
    when(context.getSystemService(Context.CONNECTIVITY_SERVICE)).thenReturn(manager);
    monitor = new AsyncConnectivityMonitorFactory(tasks::add).build(context, listener);
  }

  private void drain() {
    while (!tasks.isEmpty()) tasks.remove().run();
  }

  private ConnectivityManager.NetworkCallback callback() {
    ArgumentCaptor<ConnectivityManager.NetworkCallback> captor = ArgumentCaptor.forClass(ConnectivityManager.NetworkCallback.class);
    verify(manager, atLeastOnce()).registerDefaultNetworkCallback(captor.capture());
    return captor.getValue();
  }

  @Test
  public void glideModuleInstallsTheAsyncFactory() {
    GlideBuilder builder = mock(GlideBuilder.class);
    new ExpoImageAppGlideModule().applyOptions(context, builder);
    ArgumentCaptor<ConnectivityMonitorFactory> captor = ArgumentCaptor.forClass(ConnectivityMonitorFactory.class);
    verify(builder).setConnectivityMonitorFactory(captor.capture());
    assertTrue(captor.getValue() instanceof AsyncConnectivityMonitorFactory);
  }

  @Test
  public void startAndStopNeverCallConnectivityManagerInline() {
    monitor.onStart();
    verifyNoInteractions(manager);
    monitor.onStart();
    assertEquals(1, tasks.size());
    drain();
    ConnectivityManager.NetworkCallback callback = callback();
    monitor.onStop();
    verify(manager, never()).unregisterNetworkCallback(any(ConnectivityManager.NetworkCallback.class));
    drain();
    verify(manager).unregisterNetworkCallback(callback);
  }

  @Test
  public void initialAvailabilityAndReconnectNotifyGlideOnMainThread() {
    monitor.onStart();
    drain();
    ConnectivityManager.NetworkCallback callback = callback();
    callback.onAvailable(mock(Network.class));
    callback.onLost(mock(Network.class));
    callback.onAvailable(mock(Network.class));
    verifyNoInteractions(listener);
    doAnswer(call -> {
      assertEquals(Looper.getMainLooper(), Looper.myLooper());
      return null;
    }).when(listener).onConnectivityChanged(anyBoolean());
    shadowOf(Looper.getMainLooper()).idle();
    var order = inOrder(listener);
    order.verify(listener).onConnectivityChanged(true);
    order.verify(listener).onConnectivityChanged(false);
    order.verify(listener).onConnectivityChanged(true);
  }

  @Test
  public void stopBeforeRegistrationCancelsIt() {
    monitor.onStart();
    monitor.onStop();
    drain();
    verifyNoInteractions(manager);
  }

  @Test
  public void staleCallbacksDoNotReachStoppedOrRestartedRequests() {
    monitor.onStart();
    drain();
    ConnectivityManager.NetworkCallback old = callback();
    old.onAvailable(mock(Network.class));
    monitor.onStop();
    monitor.onStart();
    drain();
    old.onLost(mock(Network.class));
    shadowOf(Looper.getMainLooper()).idle();
    verifyNoInteractions(listener);
    callback().onAvailable(mock(Network.class));
    shadowOf(Looper.getMainLooper()).idle();
    verify(listener).onConnectivityChanged(true);
    verify(manager).unregisterNetworkCallback(old);
  }

  @Test
  public void destroyUnregistersAndCannotRestart() {
    monitor.onStart();
    drain();
    ConnectivityManager.NetworkCallback callback = callback();
    monitor.onDestroy();
    monitor.onStart();
    callback.onAvailable(mock(Network.class));
    drain();
    shadowOf(Looper.getMainLooper()).idle();
    verifyNoInteractions(listener);
    verify(manager).unregisterNetworkCallback(callback);
    verify(manager, times(1)).registerDefaultNetworkCallback(any(ConnectivityManager.NetworkCallback.class));
  }

  @Test
  public void missingPermissionDoesNotRegister() {
    when(context.checkPermission(eq(Manifest.permission.ACCESS_NETWORK_STATE), anyInt(), anyInt()))
        .thenReturn(PackageManager.PERMISSION_DENIED);
    monitor.onStart();
    drain();
    verifyNoInteractions(manager);
  }

  @Test
  public void failedRegistrationDoesNotUnregisterAndCanRetryAfterStop() {
    doThrow(new SecurityException("denied")).doNothing().when(manager)
        .registerDefaultNetworkCallback(any(ConnectivityManager.NetworkCallback.class));
    monitor.onStart();
    drain();
    monitor.onStop();
    drain();
    verify(manager, never()).unregisterNetworkCallback(any(ConnectivityManager.NetworkCallback.class));
    monitor.onStart();
    drain();
    callback().onAvailable(mock(Network.class));
    shadowOf(Looper.getMainLooper()).idle();
    verify(listener).onConnectivityChanged(true);
  }

  @Test
  public void blockedBinderDoesNotBlockMainThreadOrLoseCleanup() throws Exception {
    ExecutorService worker = Executors.newSingleThreadExecutor();
    CountDownLatch entered = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    AtomicReference<Thread> registrationThread = new AtomicReference<>();
    doAnswer(call -> {
      registrationThread.set(Thread.currentThread());
      entered.countDown();
      assertTrue(release.await(5, TimeUnit.SECONDS));
      return null;
    }).when(manager).registerDefaultNetworkCallback(any(ConnectivityManager.NetworkCallback.class));
    ConnectivityMonitor async = new AsyncConnectivityMonitorFactory(worker).build(context, listener);
    try {
      async.onStart();
      assertTrue(entered.await(5, TimeUnit.SECONDS));
      assertNotSame(Thread.currentThread(), registrationThread.get());
      async.onStop();
      shadowOf(Looper.getMainLooper()).idle();
      release.countDown();
      worker.submit(() -> {}).get(5, TimeUnit.SECONDS);
      ConnectivityManager.NetworkCallback registered = callback();
      verify(manager).unregisterNetworkCallback(registered);
    } finally {
      release.countDown();
      worker.shutdownNow();
    }
  }
}
