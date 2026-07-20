import ExpoModulesCore
import PDFKit
import UIKit

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
      // Thumbnails render at roughly a third of the screen width, so drawing each page at
      // full size and screen scale wastes tens of megabytes per page and can get the app
      // killed by the OS for memory overuse on large documents.
      let maxThumbnailDimension: CGFloat = 480
      let scale = min(1, maxThumbnailDimension / max(pageRect.width, pageRect.height))
      let renderSize = CGSize(width: pageRect.width * scale, height: pageRect.height * scale)
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      let renderer = UIGraphicsImageRenderer(size: renderSize, format: format)
      let image = renderer.image { ctx in
        UIColor.white.setFill()
        ctx.fill(CGRect(origin: .zero, size: renderSize))
        ctx.cgContext.translateBy(x: 0, y: renderSize.height)
        ctx.cgContext.scaleBy(x: scale, y: -scale)
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
