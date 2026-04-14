import { requireOptionalNativeModule } from "expo";

type ThumbnailResult = {
  uri: string;
  width: number;
  height: number;
};

const PdfThumbnailModule = requireOptionalNativeModule<{
  generate(filePath: string, page: number, quality: number): Promise<ThumbnailResult>;
}>("PdfThumbnail");

export const generateThumbnail = (filePath: string, page: number, quality = 80): Promise<ThumbnailResult> => {
  if (!PdfThumbnailModule) {
    return Promise.reject(new Error("PdfThumbnail native module is unavailable"));
  }

  return PdfThumbnailModule.generate(filePath, page, Math.min(Math.max(quality, 0), 100));
};
