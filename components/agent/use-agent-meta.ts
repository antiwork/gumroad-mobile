import { fetchAgentMeta } from "@/lib/agent";
import { useAuthedRequest } from "@/lib/authed-request";
import { useAuth } from "@/lib/auth-context";
import { RequestError } from "@/lib/request";
import { useQuery } from "@tanstack/react-query";

interface AgentMeta {
  enabled: boolean;
  greeting: string;
  suggestions: string[];
}

export const useAgentMeta = () => {
  const { accessToken } = useAuth();
  const authedRequest = useAuthedRequest();

  return useQuery<AgentMeta>({
    queryKey: ["agent-meta", accessToken],
    enabled: !!accessToken,
    queryFn: () =>
      authedRequest(async (token) => {
        try {
          const data = await fetchAgentMeta(token);
          return { enabled: data.enabled, greeting: data.greeting, suggestions: data.suggestions };
        } catch (error) {
          if (error instanceof RequestError && error.statusCode === 403) {
            return { enabled: false, greeting: "", suggestions: [] };
          }
          throw error;
        }
      }),
  });
};
