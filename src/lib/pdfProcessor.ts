import { PDFDocument } from 'pdf-lib';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * processPdfCrop - Applies a crop region to all pages of a PDF document.
 * This is useful for multi-label files where the same crop applies to every sheet.
 * Coordinates are converted from visual points to PDF points before being passed here.
 */
export async function processPdfCrop(
  arrayBuffer: ArrayBuffer,
  pdfCrop: CropArea
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Coordinates are already scaled to PDF points.
    // We ensure they are within the bounds of each specific page.
    const safeX = Math.max(0, Math.min(width, pdfCrop.x));
    const safeY = Math.max(0, Math.min(height, pdfCrop.y));
    const safeWidth = Math.max(1, Math.min(width - safeX, pdfCrop.width));
    const safeHeight = Math.max(1, Math.min(height - safeY, pdfCrop.height));

    // Set the CropBox (defines the visible region)
    page.setCropBox(safeX, safeY, safeWidth, safeHeight);
    
    // Set MediaBox to shrink the physical page size to match the crop area
    page.setMediaBox(safeX, safeY, safeWidth, safeHeight);
  }

  // Save and return the entire document with all pages cropped.
  return await pdfDoc.save();
}
