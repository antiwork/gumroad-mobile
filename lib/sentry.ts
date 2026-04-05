import * as Sentry from "@sentry/react-native";
import { NATIVE } from "@sentry/react-native/dist/js/wrapper";
import { env } from "@/lib/env";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

const mobileReplay = Sentry.mobileReplayIntegration({
  excludedViewClasses: ["ExpoVideo.VideoView"],
});

Sentry.init({
  dsn: env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: __DEV__ ? 1 : 0.1,
  replaysSessionSampleRate: __DEV__ ? 1 : 0,
  replaysOnErrorSampleRate: __DEV__ ? 1 : 0.1,
  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value ?? event.exception?.values?.[0]?.type;
    if (message === "Network request failed" || message === "TypeError: Network request failed") {
      return null;
    }
    if (message?.includes("User interaction is not allowed")) {
      return null;
    }
    return event;
  },
  integrations: [
    navigationIntegration,
    mobileReplay,
    Sentry.feedbackIntegration({
      colorScheme: "system",
      themeLight: {
        background: "#ffffff",
        foreground: "#000000",
        accentBackground: "#ff90e8",
        accentForeground: "#000000",
        border: "#000000",
      },
      themeDark: {
        background: "#000000",
        foreground: "#dedede",
        accentBackground: "#ff90e8",
        accentForeground: "#000000",
        border: "#555555",
      },
    }),
  ],
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
