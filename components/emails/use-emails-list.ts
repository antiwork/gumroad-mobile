import { useAPIRequest } from "@/lib/request";
import type { EmailsListResponse } from "./types";

export const EMAILS_QUERY_KEY = ["emails", "published"] as const;

export const useEmailsList = () =>
  useAPIRequest<EmailsListResponse>({
    url: "mobile/emails",
    queryKey: [...EMAILS_QUERY_KEY],
    staleTime: 30 * 1000,
  });
