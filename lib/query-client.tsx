import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { AppState, Platform } from "react-native";

focusManager.setEventListener((handleFocus) => {
  if (Platform.OS === "web") return;
  const subscription = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });
  return () => subscription.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export const QueryProvider = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
