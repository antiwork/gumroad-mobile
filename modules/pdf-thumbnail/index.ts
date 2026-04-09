import { requireNativeModule } from "expo";

type ThumbnailResult = {
  uri: string;
  width: number;
  height: number;
};

const PdfThumbnailModule = requireNativeModule<{
  generate(filePath: string, page: number, quality: number): Promise<ThumbnailResult>;
}>("PdfThumbnail");

export const generateThumbnail = (filePath: string, page: number, quality = 80): Promise<ThumbnailResult> =>
  PdfThumbnailModule.generate(filePath, page, Math.min(Math.max(quality, 0), 100));
