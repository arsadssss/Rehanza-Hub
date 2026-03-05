
import { PDFDocument } from 'pdf-lib';

/**
 * processPdfCrop - Extracts a specific region from the first page of a PDF.
 * Uses percentage-based coordinates to remain independent of preview zoom/scale.
 * 
 * @param arrayBuffer - Raw bytes of the uploaded PDF
 * @param crop - Crop area { x, y, width, height } in percentages (0-100)
 * @returns Uint8Array of the new cropped PDF
 */
export async function processPdfCrop(
  arrayBuffer: ArrayBuffer,
  crop: { x: number; y: number; width: number; height: number }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width, height } = firstPage.getSize();

  // PDF coordinate system starts from bottom-left (0,0)
  // Our screen coordinates start from top-left (0,0)
  
  const cropX = (crop.x / 100) * width;
  const cropWidth = (crop.width / 100) * width;
  const cropHeight = (crop.height / 100) * height;
  
  // Calculate Y from bottom (standard PDF geometry)
  const cropY = height - ((crop.y + crop.height) / 100) * height;

  // Ensure coordinates don't exceed page bounds
  const safeX = Math.max(0, cropX);
  const safeY = Math.max(0, cropY);
  const safeWidth = Math.min(width - safeX, cropWidth);
  const safeHeight = Math.min(height - safeY, cropHeight);

  // Set the CropBox (defines the visible region of the page)
  firstPage.setCropBox(safeX, safeY, safeWidth, safeHeight);

  // Also set MediaBox to shrink the physical canvas to the crop size for thermal printing
  firstPage.setMediaBox(safeX, safeY, safeWidth, safeHeight);

  // Create a new document containing only this cropped page to keep the file size minimal
  const newPdfDoc = await PDFDocument.create();
  const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
  newPdfDoc.addPage(copiedPage);

  return await newPdfDoc.save();
}
