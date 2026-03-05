
import { PDFDocument } from 'pdf-lib';

/**
 * processPdfCrop - Extracts a specific region from the first page of a PDF.
 * 
 * @param arrayBuffer - Raw bytes of the uploaded PDF
 * @param crop - Normalized crop area { x, y, width, height } in percentages (0-100)
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
  // react-easy-crop coordinates start from top-left (0,0)
  
  const cropX = (crop.x / 100) * width;
  const cropY = height - ((crop.y + crop.height) / 100) * height; // Convert top-left Y to bottom-left Y
  const cropWidth = (crop.width / 100) * width;
  const cropHeight = (crop.height / 100) * height;

  // Set the CropBox (defines the visible region of the page)
  firstPage.setCropBox(cropX, cropY, cropWidth, cropHeight);

  // Optional: Also set MediaBox to shrink the physical canvas to the crop size
  firstPage.setMediaBox(cropX, cropY, cropWidth, cropHeight);

  // Create a new document containing only this cropped page
  const newPdfDoc = await PDFDocument.create();
  const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
  newPdfDoc.addPage(copiedPage);

  return await newPdfDoc.save();
}
