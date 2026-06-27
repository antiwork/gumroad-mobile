import { Directory, File, Paths } from "expo-file-system";

const MAX_FILE_NAME_LENGTH = 200;
const UNSAFE_FILE_NAME_CHARS = /[/\\:*?"<>|%#[\]{}^`]/g;

const sanitizeFileName = (name: string) =>
  name.replace(UNSAFE_FILE_NAME_CHARS, "_").slice(0, MAX_FILE_NAME_LENGTH).trim() || "file";

export const cacheFileDestination = (uniqueKey: string, fileName: string) => {
  const dir = new Directory(Paths.cache, uniqueKey);
  try {
    if (!dir.exists) dir.create({ idempotent: true });
  } catch {}
  return new File(dir, sanitizeFileName(fileName));
};
