import { fetchAgentMeta } from "@/lib/agent";
import { KeychainUnavailableError, UnauthorizedError } from "@/lib/request";
import { useAuth } from "@/lib/auth-context";
import { assertDefined } from "@/lib/assert";
import { useQuery } from "@tanstack/react-query";

interface AgentMeta {
  enabled: boolean;
  greeting: string;
  suggestions: string[];
}

export const useAgentMeta = () => {
  const { accessToken, refreshToken, logout } = useAuth();

  return useQuery<AgentMeta>({
    queryKey: ["agent-meta", accessToken],
    enabled: !!accessToken,
    queryFn: async () => {
      const run = async (token: string) => {
        try {
          const data = await fetchAgentMeta(token);
          return { enabled: data.enabled, greeting: data.greeting, suggestions: data.suggestions };
        } catch (error) {
          if (error instanceof Error && error.message.includes("403")) {
            return { enabled: false, greeting: "", suggestions: [] };
          }
          throw error;
        }
      };

      try {
        return await run(assertDefined(accessToken));
      } catch (error) {
        if (!(error instanceof UnauthorizedError)) throw error;
        try {
          const newToken = await refreshToken();
          return await run(newToken);
        } catch (refreshError) {
          if (refreshError instanceof KeychainUnavailableError) throw error;
          await logout();
          throw error;
        }
      }
    },
  });
};
