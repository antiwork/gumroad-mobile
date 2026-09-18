package com.github.barteksc.pdfviewer;

import static org.junit.Assert.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import android.content.Context;
import android.graphics.RectF;
import android.os.HandlerThread;
import io.legere.pdfiumandroid.PdfiumCore;
import io.legere.pdfiumandroid.util.Config;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Implementation;
import org.robolectric.annotation.Implements;
import org.robolectric.annotation.LooperMode;
import org.robolectric.util.ReflectionHelpers;
import org.wonday.pdf.PdfView;

@RunWith(RobolectricTestRunner.class)
@org.robolectric.annotation.Config(sdk = 28, shadows = RenderingDrainTest.ShadowPdfiumCore.class)
@LooperMode(LooperMode.Mode.PAUSED)
public class RenderingDrainTest {
    private static final int TIMEOUT_SECONDS = 5;
    private static final int BITMAP_SIZE = 16;
    private final CountDownLatch renderStarted = new CountDownLatch(1);
    private final CountDownLatch finishRender = new CountDownLatch(1);
    private HandlerThread renderer;
    private RenderingHandler handler;
    private TestPdfView view;
    private PdfFile document;
    private Thread recycler;

    @Before
    public void setUp() {
        view = new TestPdfView(RuntimeEnvironment.getApplication());
        document = mock(PdfFile.class);
        renderer = new HandlerThread("PDF rendering test");
        renderer.setDaemon(true);
        renderer.start();
        handler = new RenderingHandler(renderer.getLooper(), view);
        handler.start();
        ((PDFView) view).renderingHandler = handler;
        ((PDFView) view).pdfFile = document;
        ReflectionHelpers.setField(view, "renderingHandlerThread", renderer);
        ReflectionHelpers.setField(view, "recycled", false);
        doAnswer(invocation -> {
            renderStarted.countDown();
            assertTrue("Render was not released", finishRender.await(TIMEOUT_SECONDS, TimeUnit.SECONDS));
            return null;
        }).when(document).renderPageBitmap(any(), anyInt(), any(), anyBoolean());
    }

    @After
    public void tearDown() throws Exception {
        finishRender.countDown();
        renderer.quitSafely();
        renderer.join(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS));
        if (recycler != null) {
            recycler.join(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS));
            assertFalse("Cleanup did not finish", recycler.isAlive());
        }
        assertFalse("Renderer did not finish", renderer.isAlive());
    }

    @Test
    public void recycleWaitsForActiveRenderingAndDropsQueuedPages() throws Exception {
        startRendering();
        queueRender();

        FutureTask<Boolean> cleanup = recycleAsync(view::recycle, false);
        assertWaitingForRender(cleanup);
        assertFalse(handler.hasMessages(RenderingHandler.MSG_RENDER_TASK));

        finishRender.countDown();
        assertFalse(cleanup.get(TIMEOUT_SECONDS, TimeUnit.SECONDS));
        verify(document).renderPageBitmap(any(), anyInt(), any(), anyBoolean());
        verify(document).dispose();
        assertTrue(view.isRecycled());
        assertNull(((PDFView) view).pdfFile);
        assertNull(((PDFView) view).renderingHandler);
    }

    @Test
    public void detachingWaitsForRenderingBeforeClosingTheDocumentAndThread() throws Exception {
        startRendering();

        FutureTask<Boolean> cleanup = recycleAsync(view::detach, false);
        assertWaitingForRender(cleanup);

        finishRender.countDown();
        cleanup.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        renderer.join(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS));
        verify(document).dispose();
        assertFalse(renderer.isAlive());
        assertNull(ReflectionHelpers.getField(view, "renderingHandlerThread"));
    }

    @Test
    public void interruptionDoesNotCloseTheDocumentBeforeRenderingFinishes() throws Exception {
        startRendering();

        FutureTask<Boolean> cleanup = recycleAsync(view::recycle, true);
        assertWaitingForRender(cleanup);

        finishRender.countDown();
        assertTrue("Cleanup must restore interruption", cleanup.get(TIMEOUT_SECONDS, TimeUnit.SECONDS));
        verify(document).dispose();
    }

    @Test
    public void rejectedBarrierWaitsForTheQuittingRenderer() throws Exception {
        startRendering();
        renderer.quitSafely();

        FutureTask<Boolean> cleanup = recycleAsync(view::recycle, false);
        assertWaitingForRender(cleanup);

        finishRender.countDown();
        cleanup.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        verify(document).dispose();
        assertFalse(renderer.isAlive());
    }

    @Test
    public void recyclingWithoutARendererCompletesAndRemainsIdempotent() throws Exception {
        ((PDFView) view).renderingHandler = null;

        recycleAsync(() -> {
            view.recycle();
            view.recycle();
        }, false).get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        verify(document).dispose();
        assertTrue(view.isRecycled());
    }

    @Test
    public void recyclingOnTheRenderThreadFailsWithoutClosingTheDocument() throws Exception {
        FutureTask<Throwable> cleanup = new FutureTask<>(() -> {
            try {
                view.recycle();
                return null;
            } catch (IllegalStateException exception) {
                return exception;
            }
        });
        assertTrue(handler.post(cleanup));

        assertTrue(cleanup.get(TIMEOUT_SECONDS, TimeUnit.SECONDS) instanceof IllegalStateException);
        verify(document, never()).dispose();
        assertFalse(view.isRecycled());
    }

    private void startRendering() throws Exception {
        queueRender();
        assertTrue("Rendering did not start", renderStarted.await(TIMEOUT_SECONDS, TimeUnit.SECONDS));
    }

    private void queueRender() {
        handler.addRenderingTask(0, BITMAP_SIZE, BITMAP_SIZE, new RectF(0, 0, 1, 1), false, 0, false, false);
    }

    private FutureTask<Boolean> recycleAsync(Runnable action, boolean interrupt) {
        FutureTask<Boolean> cleanup = new FutureTask<>(() -> {
            if (interrupt) Thread.currentThread().interrupt();
            action.run();
            return Thread.currentThread().isInterrupted();
        });
        recycler = new Thread(cleanup, "PDF cleanup test");
        recycler.setDaemon(true);
        recycler.start();
        return cleanup;
    }

    private void assertWaitingForRender(FutureTask<?> cleanup) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(TIMEOUT_SECONDS);
        while (recycler.getState() != Thread.State.WAITING && !cleanup.isDone() && System.nanoTime() < deadline) {
            Thread.yield();
        }
        assertFalse("Cleanup returned before rendering finished", cleanup.isDone());
        assertEquals("Cleanup must wait for rendering", Thread.State.WAITING, recycler.getState());
        verify(document, never()).dispose();
        assertFalse(view.isRecycled());
    }

    private static class TestPdfView extends PdfView {
        TestPdfView(Context context) {
            super(context, null);
        }

        void detach() {
            super.onDetachedFromWindow();
        }
    }

    @Implements(PdfiumCore.class)
    public static class ShadowPdfiumCore {
        @Implementation
        protected static void __staticInitializer__() {}

        @Implementation
        protected void __constructor__(Context context, Config config) {}
    }
}
