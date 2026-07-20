import * as Sentry from "@sentry/react-native";
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

// expo-file-system reports HTTP failures as "response has status: <code>" in the error message.
const httpStatusFromError = (error: unknown) => {
  if (!(error instanceof Error)) return null;
  const match = /response has status:? (\d{3})/.exec(error.message);
  return match ? Number(match[1]) : null;
};

const isNotFoundError = (error: unknown) => httpStatusFromError(error) === 404;

// Thrown when a download still 404s after fetching a fresh URL and retrying: the file is
// gone or unpublished, which is a content problem, not an app bug — callers show their
// error state and must not report this to Sentry.
export class FileUnavailableError extends Error {
  constructor() {
    super("This file is unavailable right now. Please try again later.");
    this.name = "FileUnavailableError";
  }
}

type DownloadOptions = {
  refreshUrl?: () => Promise<string>;
};

const download = (url: string, destination: File | Directory) =>
  File.downloadFileAsync(url, destination, { idempotent: true });

// Download URLs go stale (the redirect token can rotate while the app is backgrounded), so a
// 404 gets one retry against a freshly derived URL from the caller's refreshUrl callback.
const retryAfterNotFound = async (
  url: string,
  destination: File | Directory,
  refreshUrl?: () => Promise<string>,
): Promise<File> => {
  let freshUrl = url;
  if (refreshUrl) {
    try {
      freshUrl = await refreshUrl();
    } catch {
      // Refreshing needs its own network call; when it fails, the original URL is still worth one retry.
    }
  }
  try {
    return await download(freshUrl, destination);
  } catch (retryError) {
    if (!isNotFoundError(retryError)) throw retryError;
    Sentry.addBreadcrumb({
      category: "download",
      level: "warning",
      message: "Download returned 404 after URL refresh and retry",
      data: { urlRefreshed: freshUrl !== url },
    });
    throw new FileUnavailableError();
  }
};

export const downloadFileWithRetry = async (
  url: string,
  destination: File | Directory,
  options?: DownloadOptions,
): Promise<File> => {
  try {
    return await download(url, destination);
  } catch (error) {
    if (isNotFoundError(error)) return await retryAfterNotFound(url, destination, options?.refreshUrl);
    // Other HTTP status failures are deterministic, so retrying only wastes time; everything else
    // is a dropped connection or timeout, which on mobile networks usually succeeds on a second attempt.
    if (httpStatusFromError(error) !== null) throw error;
    return await download(url, destination);
  }
};
