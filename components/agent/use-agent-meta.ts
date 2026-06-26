import { fetchAgentMeta } from "@/lib/agent";
import { UnauthorizedError } from "@/lib/request";
import { useAuth } from "@/lib/auth-context";
import { assertDefined } from "@/lib/assert";
import { useQuery } from "@tanstack/react-query";

interface AgentMeta {
  enabled: boolean;
  greeting: string;
  suggestions: string[];
}

// The meta endpoint returns 403 when the seller isn't entitled to the agent. We surface that as
// `enabled: false` rather than an error so the screen can show a friendly empty state.
export const useAgentMeta = () => {
  const { accessToken, refreshToken, logout } = useAuth();

  return useQuery<AgentMeta>({
    queryKey: ["agent-meta"],
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
        } catch {
          await logout();
          throw error;
        }
      }
    },
  });
};
