import { buildApiUrl } from "@/lib/request";

export const productFileDownloadUrl = (urlRedirectToken: string, productFileId: string) =>
  buildApiUrl(`/mobile/url_redirects/download/${urlRedirectToken}/${productFileId}`);
