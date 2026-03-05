
import { PDFDocument } from 'pdf-lib';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * processPdfCrop - Extracts a specific region from the first page of a PDF.
 * Converts visual coordinates into PDF points.
 */
export async function processPdfCrop(
  arrayBuffer: ArrayBuffer,
  pdfCrop: CropArea
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width, height } = firstPage.getSize();

  // Coordinates are already scaled to PDF points before passing to this function
  // We just need to ensure they are within bounds
  const safeX = Math.max(0, Math.min(width, pdfCrop.x));
  const safeY = Math.max(0, Math.min(height, pdfCrop.y));
  const safeWidth = Math.max(1, Math.min(width - safeX, pdfCrop.width));
  const safeHeight = Math.max(1, Math.min(height - safeY, pdfCrop.height));

  // Set the CropBox (defines the visible region)
  firstPage.setCropBox(safeX, safeY, safeWidth, safeHeight);
  
  // Set MediaBox to shrink the physical page size to match the crop
  firstPage.setMediaBox(safeX, safeY, safeWidth, safeHeight);

  // Create a new document with only the cropped page
  const newPdfDoc = await PDFDocument.create();
  const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
  newPdfDoc.addPage(copiedPage);

  return await newPdfDoc.save();
}
