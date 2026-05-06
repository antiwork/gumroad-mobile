import { useAPIRequest } from "@/lib/request";

export type AudienceType = "audience" | "seller" | "follower" | "affiliate";

export type AudienceOption = {
  type: AudienceType;
  label: string;
  count: number;
};

export type Eligibility = {
  can_send_emails: boolean;
  reason: string | null;
  learn_more_url: string | null;
};

export type AudienceOptionsResponse = {
  options: AudienceOption[];
  eligibility: Eligibility;
  has_profile_sections: boolean;
};

export const useAudienceOptions = () =>
  useAPIRequest<AudienceOptionsResponse>({
    url: "mobile/emails/audience_options",
    queryKey: ["mobile", "emails", "audience_options"],
    staleTime: 5 * 60 * 1000,
  });
