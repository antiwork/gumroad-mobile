import { useCallback } from "react";
import type { WebViewMessageEvent } from "react-native-webview";

type MessageHandler<T extends string, P> = {
  type: T;
  handler: (payload: P) => void | Promise<void>;
};

type AnyMessageHandler = MessageHandler<string, unknown>;

export const useWebViewMessage = (handlers: AnyMessageHandler[]) => {
  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;

      let parsed: { type?: string; payload?: unknown };
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn("Failed to parse WebView message:", raw);
        return;
      }

      if (!parsed.type) {
        console.warn("WebView message missing type:", parsed);
        return;
      }

      console.info("WebView message received:", parsed);

      const match = handlers.find((h) => h.type === parsed.type);
      if (match) {
        await match.handler(parsed.payload);
      } else {
        console.warn("Unhandled WebView message type:", parsed.type);
      }
    },
    [handlers],
  );

  return onMessage;
};
