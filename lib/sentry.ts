import * as Sentry from "@sentry/react-native";
import { NATIVE } from "@sentry/react-native/dist/js/wrapper";
import { env } from "@/lib/env";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

const mobileReplay = Sentry.mobileReplayIntegration();

Sentry.init({
  dsn: env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: __DEV__ ? 1 : 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [navigationIntegration, mobileReplay, Sentry.feedbackIntegration()],
});

Sentry.getClient()?.on("beforeSendFeedback", (feedbackEvent) => {
  // Make sure we attach the session replay (available because replaysOnErrorSampleRate is 1, but not currently enabled in the React Native SDK for feedback)
  const replayId = mobileReplay.getReplayId();
  if (replayId && feedbackEvent.contexts?.feedback) {
    feedbackEvent.contexts.feedback.replay_id = replayId;
  }
});

export const flushReplayBuffer = () => NATIVE.captureReplay(false);

export { Sentry };
