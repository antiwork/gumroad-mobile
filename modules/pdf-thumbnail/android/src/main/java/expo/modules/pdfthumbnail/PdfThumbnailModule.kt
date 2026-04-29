package expo.modules.pdfthumbnail

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class PdfThumbnailModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PdfThumbnail")

    AsyncFunction("generate") Coroutine { filePath: String, page: Int, quality: Int ->
      val file = resolveFile(filePath)
      if (!file.exists()) {
        throw CodedException("ERR_PDF_OPEN", "Could not open PDF at $filePath", null)
      }

      val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
      try {
        val renderer = PdfRenderer(descriptor)
        try {
          if (page < 0 || page >= renderer.pageCount) {
            throw CodedException("ERR_PDF_PAGE", "Page $page not found in PDF", null)
          }

          val pdfPage = renderer.openPage(page)
          try {
            val width = pdfPage.width
            val height = pdfPage.height
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            try {
              bitmap.eraseColor(Color.WHITE)
              pdfPage.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

              val outputFile = File(context.cacheDir, "pdf_thumb_${UUID.randomUUID()}.jpg")
              FileOutputStream(outputFile).use { stream ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
              }

              mapOf(
                "uri" to Uri.fromFile(outputFile).toString(),
                "width" to width,
                "height" to height
              )
            } finally {
              bitmap.recycle()
            }
          } finally {
            pdfPage.close()
          }
        } finally {
          renderer.close()
        }
      } finally {
        descriptor.close()
      }
    }
  }

  private fun resolveFile(filePath: String): File {
    if (filePath.startsWith("file://")) {
      return File(Uri.parse(filePath).path!!)
    }
    if (filePath.startsWith("content://")) {
      val inputStream = context.contentResolver.openInputStream(Uri.parse(filePath))
        ?: throw CodedException("ERR_PDF_OPEN", "Could not open content URI: $filePath", null)
      val tempFile = File(context.cacheDir, "pdf_input_${UUID.randomUUID()}.pdf")
      inputStream.use { input ->
        FileOutputStream(tempFile).use { output ->
          input.copyTo(output)
        }
      }
      return tempFile
    }
    return File(filePath)
  }
}
