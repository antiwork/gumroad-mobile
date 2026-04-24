import { requireNativeModule } from "expo";

type ThumbnailResult = {
  uri: string;
  width: number;
  height: number;
};

type PdfThumbnailNative = {
  generate(filePath: string, page: number, quality: number): Promise<ThumbnailResult>;
};

let cached: PdfThumbnailNative | null | undefined;
const getModule = (): PdfThumbnailNative | null => {
  if (cached !== undefined) return cached;
  try {
    cached = requireNativeModule<PdfThumbnailNative>("PdfThumbnail");
  } catch {
    cached = null;
  }
  return cached;
};

export const generateThumbnail = (filePath: string, page: number, quality = 80): Promise<ThumbnailResult> => {
  const mod = getModule();
  if (!mod) return Promise.reject(new Error("PdfThumbnail native module is not available"));
  return mod.generate(filePath, page, Math.min(Math.max(quality, 0), 100));
};
