import ExpoModulesCore
import PDFKit

public class PdfThumbnailModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PdfThumbnail")

    AsyncFunction("generate") { (filePath: String, page: Int, quality: Int) -> [String: Any] in
      guard let url = URL(string: filePath) ?? URL(fileURLWithPath: filePath) as URL?,
            let document = PDFDocument(url: url) else {
        throw Exception(name: "ERR_PDF_OPEN", description: "Could not open PDF at \(filePath)")
      }

      guard let pdfPage = document.page(at: page) else {
        throw Exception(name: "ERR_PDF_PAGE", description: "Page \(page) not found in PDF")
      }

      let pageRect = pdfPage.bounds(for: .mediaBox)
      let renderer = UIGraphicsImageRenderer(size: pageRect.size)
      let image = renderer.image { ctx in
        UIColor.white.setFill()
        ctx.fill(pageRect)
        ctx.cgContext.translateBy(x: 0, y: pageRect.height)
        ctx.cgContext.scaleBy(x: 1, y: -1)
        pdfPage.draw(with: .mediaBox, to: ctx.cgContext)
      }

      let jpegQuality = CGFloat(quality) / 100.0
      guard let data = image.jpegData(compressionQuality: jpegQuality) else {
        throw Exception(name: "ERR_PDF_RENDER", description: "Failed to render page as JPEG")
      }

      let tempDir = FileManager.default.temporaryDirectory
      let fileName = "pdf_thumb_\(UUID().uuidString).jpg"
      let fileURL = tempDir.appendingPathComponent(fileName)
      try data.write(to: fileURL)

      return [
        "uri": fileURL.absoluteString,
        "width": Int(pageRect.width),
        "height": Int(pageRect.height)
      ]
    }
  }
}
