import { PdfNavigationSheet } from "@/components/pdf-navigation-sheet";
import { render, waitFor } from "@testing-library/react-native";

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: "/cache" },
}));

jest.mock("@/modules/pdf-thumbnail", () => ({
  generateThumbnail: jest.fn().mockResolvedValue({ uri: "file:///thumb.jpg", width: 300, height: 420 }),
}));

const renderSheet = (uri: string) =>
  render(
    <PdfNavigationSheet
      open
      onOpenChange={jest.fn()}
      uri={uri}
      tableOfContents={[]}
      totalPages={1}
      currentPage={1}
      onPageSelect={jest.fn()}
    />,
  );

describe("PdfNavigationSheet", () => {
  beforeEach(() => {
    const { File } = require("expo-file-system");
    const { generateThumbnail } = require("@/modules/pdf-thumbnail");
    File.downloadFileAsync.mockReset();
    File.downloadFileAsync.mockResolvedValue({ uri: "file:///cache/downloaded.pdf" });
    generateThumbnail.mockClear();
  });

  it("downloads remote PDFs before generating thumbnails", async () => {
    const { File } = require("expo-file-system");
    const { generateThumbnail } = require("@/modules/pdf-thumbnail");

    renderSheet("https://example.com/test.pdf");

    await waitFor(() =>
      expect(File.downloadFileAsync).toHaveBeenCalledWith("https://example.com/test.pdf", "/cache", {
        idempotent: true,
      }),
    );
    await waitFor(() => expect(generateThumbnail).toHaveBeenCalledWith("file:///cache/downloaded.pdf", 0, 60));
  });

  it("uses local file URI directly without downloading it again", async () => {
    const { File } = require("expo-file-system");
    const { generateThumbnail } = require("@/modules/pdf-thumbnail");

    renderSheet("file:///cache/test.pdf");

    await waitFor(() => expect(generateThumbnail).toHaveBeenCalledWith("file:///cache/test.pdf", 0, 60));
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });
});
