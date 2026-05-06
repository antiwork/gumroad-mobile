import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import { useCallback, useRef, useState } from "react";

export type FileUploadStatus = "idle" | "uploading_blob" | "uploading_s3" | "fetching_cdn_url" | "uploaded" | "failed";

export type FileAsset = {
  uri: string;
  fileName?: string | null;
  name?: string | null;
  fileSize?: number | null;
  size?: number | null;
  mimeType?: string | null;
};

export type UploadResult = {
  cdnUrl: string;
  signedId: string;
  filename: string;
  byteSize: number;
  mimeType: string;
};

type DirectUploadResponse = {
  signed_id: string;
  key: string;
  filename: string;
  byte_size: number;
  direct_upload: { url: string; headers: Record<string, string> };
};

type CdnUrlResponse = { url: string };

const md5BytesBase64 = async (bytes: Uint8Array): Promise<string> => {
  const Crypto = await import("expo-crypto");
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.MD5, new Uint8Array(bytes));
  const out = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < out.length; i++) binary += String.fromCharCode(out[i]!);
  return globalThis.btoa(binary);
};

const resolveFilename = (asset: FileAsset): string =>
  asset.fileName ?? asset.name ?? `file-${Date.now()}`;

const resolveByteSize = (asset: FileAsset, fallback: number): number =>
  asset.fileSize ?? asset.size ?? fallback;

const resolveContentType = (asset: FileAsset, fallback: string): string =>
  asset.mimeType ?? fallback;

export const useFileUpload = () => {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<FileUploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const requestIdRef = useRef(0);

  const upload = useCallback(
    async (asset: FileAsset): Promise<UploadResult | null> => {
      if (!accessToken) return null;
      const myId = ++requestIdRef.current;
      const isStale = () => requestIdRef.current !== myId;
      try {
        setStatus("uploading_blob");

        const { File } = await import("expo-file-system");
        const file = new File(asset.uri);
        const bytes = await file.bytes();
        if (isStale()) return null;
        const blob = await fetch(asset.uri).then((r) => r.blob());
        if (isStale()) return null;

        const filename = resolveFilename(asset);
        const byteSize = resolveByteSize(asset, bytes.byteLength);
        const checksum = await md5BytesBase64(bytes);
        if (isStale()) return null;
        const contentType = resolveContentType(asset, blob.type || "application/octet-stream");

        console.info("[upload] step 1: POST /mobile/direct_uploads", { filename, byteSize, contentType });
        const blobResponse = await requestAPI<DirectUploadResponse>("mobile/direct_uploads", {
          method: "POST",
          accessToken,
          data: { blob: { filename, byte_size: byteSize, checksum, content_type: contentType } },
        });
        if (isStale()) return null;

        setStatus("uploading_s3");
        const s3Response = await fetch(blobResponse.direct_upload.url, {
          method: "PUT",
          headers: blobResponse.direct_upload.headers,
          body: blob,
        });
        if (!s3Response.ok) {
          const errBody = await s3Response.text().catch(() => "<no-body>");
          throw new Error(`S3 PUT ${s3Response.status}: ${errBody.slice(0, 500)}`);
        }
        if (isStale()) return null;

        setStatus("fetching_cdn_url");
        const cdnResponse = await requestAPI<CdnUrlResponse>(
          `mobile/s3_utility/cdn_url_for_blob?key=${encodeURIComponent(blobResponse.key)}`,
          { method: "GET", accessToken },
        );
        if (isStale()) return null;

        const next: UploadResult = {
          cdnUrl: cdnResponse.url,
          signedId: blobResponse.signed_id,
          filename,
          byteSize,
          mimeType: contentType,
        };
        setResult(next);
        setStatus("uploaded");
        return next;
      } catch (error) {
        if (isStale()) return null;
        console.error("[upload] failed:", error instanceof Error ? error.message : error);
        Sentry.captureException(error);
        setStatus("failed");
        return null;
      }
    },
    [accessToken],
  );

  const reset = useCallback(() => {
    requestIdRef.current++;
    setStatus("idle");
    setResult(null);
  }, []);

  return { status, result, upload, reset };
};
