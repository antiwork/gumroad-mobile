import { Directory, File, Paths } from "expo-file-system";

const sanitizeFileName = (name: string) => name.replace(/[/\\:*?"<>|]/g, "_").trim();

export const cacheFileDestination = (uniqueKey: string, fileName: string) => {
  const dir = new Directory(Paths.cache, uniqueKey);
  if (!dir.exists) dir.create({ idempotent: true });
  return new File(dir, sanitizeFileName(fileName));
};
