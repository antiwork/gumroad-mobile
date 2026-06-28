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
