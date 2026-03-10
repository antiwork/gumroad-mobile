import * as Sentry from "@sentry/react-native";
import { env } from "@/lib/env";

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  integrations: [navigationIntegration, Sentry.feedbackIntegration()],
});

export { Sentry };
