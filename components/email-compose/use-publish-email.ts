import { assertDefined } from "@/lib/assert";
import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Attachment } from "./compose-context";
import type { AudienceType } from "./use-audience-options";

type PublishVars = {
  title: string;
  html: string;
  audienceType: AudienceType;
  attachments: Attachment[];
  idempotencyKey: string;
  sendEmails: boolean;
  shownOnProfile: boolean;
  allowComments: boolean;
};

type PublishResponse = {
  success: boolean;
  installment: {
    external_id: string;
    name: string;
    installment_type: string;
    published_at: string | null;
    message: string;
  };
};

export const usePublishEmail = () => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<PublishResponse, Error, PublishVars>({
    mutationFn: ({ title, html, audienceType, attachments, idempotencyKey, sendEmails, shownOnProfile, allowComments }) =>
      requestAPI<PublishResponse>("mobile/emails", {
        method: "POST",
        accessToken: assertDefined(accessToken),
        data: {
          installment: {
            name: title,
            message: html,
            installment_type: audienceType,
            shown_on_profile: shownOnProfile,
            send_emails: sendEmails,
            allow_comments: allowComments,
            files: attachments.map((a) => ({
              url: a.cdnUrl,
              position: a.position,
              stream_only: false,
            })),
          },
          publish: true,
          idempotency_key: idempotencyKey,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
};
