import { Directory, File, Paths } from "expo-file-system";

const MAX_FILE_NAME_LENGTH = 200;
const UNSAFE_FILE_NAME_CHARS = /[/\\:*?"<>|%#[\]{}^`]/g;

const sanitizeFileName = (name: string) => {
  const cleaned = name.replace(UNSAFE_FILE_NAME_CHARS, "_").trim();
  if (cleaned.length <= MAX_FILE_NAME_LENGTH) return cleaned || "file";
  const dotIndex = cleaned.lastIndexOf(".");
  const extension = dotIndex > 0 && cleaned.length - dotIndex <= 16 ? cleaned.slice(dotIndex) : "";
  return cleaned.slice(0, MAX_FILE_NAME_LENGTH - extension.length) + extension;
};

export const cacheFileDestination = (uniqueKey: string, fileName: string) => {
  const dir = new Directory(Paths.cache, uniqueKey);
  if (!dir.exists) dir.create({ idempotent: true });
  return new File(dir, sanitizeFileName(fileName));
};

// HTTP status failures (expo-file-system reports them as "response has status: <code>") are
// deterministic, so retrying only wastes time; everything else is a dropped connection or
// timeout, which on mobile networks usually succeeds on a second attempt.
const isRetryableDownloadError = (error: unknown) =>
  !(error instanceof Error && error.message.includes("response has status"));

export const downloadFileWithRetry = async (url: string, destination: File): Promise<File> => {
  try {
    return await File.downloadFileAsync(url, destination, { idempotent: true });
  } catch (error) {
    if (!isRetryableDownloadError(error)) throw error;
    return await File.downloadFileAsync(url, destination, { idempotent: true });
  }
};
