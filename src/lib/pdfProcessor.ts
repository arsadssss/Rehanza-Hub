import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * processPdfCrop - Applies a crop region to all pages of a PDF document.
 */
export async function processPdfCrop(
  arrayBuffer: ArrayBuffer,
  pdfCrop: CropArea
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    const safeX = Math.max(0, Math.min(width, pdfCrop.x));
    const safeY = Math.max(0, Math.min(height, pdfCrop.y));
    const safeWidth = Math.max(1, Math.min(width - safeX, pdfCrop.width));
    const safeHeight = Math.max(1, Math.min(height - safeY, pdfCrop.height));

    page.setCropBox(safeX, safeY, safeWidth, safeHeight);
    page.setMediaBox(safeX, safeY, safeWidth, safeHeight);
  }

  return await pdfDoc.save();
}

/**
 * processAmazonLabels - Specialized logic for Amazon PDFs.
 * 1. Keeps only odd pages (labels).
 * 2. Crops the label area.
 * 3. Extracts and prints the SKU on the label.
 */
export async function processAmazonLabels(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();
  const newPdf = await PDFDocument.create();
  const fontBold = await newPdf.embedFont(StandardFonts.HelveticaBold);

  // Load PDF for text extraction using pdfjs
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfJsDoc = await loadingTask.promise;

  for (let i = 0; i < totalPages; i++) {
    // Amazon Pattern: Page 1 (index 0) is Label, Page 2 (index 1) is Invoice
    // We only keep labels (even indices)
    if (i % 2 !== 0) continue;

    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    const { width, height } = copiedPage.getSize();

    // 1. Crop to Label area (Top 70% roughly)
    // Amazon standard usually has the label in the upper section
    const cropHeight = height * 0.70;
    const cropY = height * 0.30;
    copiedPage.setCropBox(0, cropY, width, cropHeight);
    copiedPage.setMediaBox(0, cropY, width, cropHeight);

    // 2. Extract SKU using PDF.js
    let sku = "SKU NOT FOUND";
    try {
      const pageJs = await pdfJsDoc.getPage(i + 1);
      const textContent = await pageJs.getTextContent();
      const textItems = textContent.items.map((item: any) => item.str).join(' ');
      
      // Amazon labels usually have SKU in parentheses: (SKU-NAME)
      const skuMatch = textItems.match(/\((.*?)\)/);
      if (skuMatch && skuMatch[1]) {
        sku = skuMatch[1];
      }
    } catch (e) {
      console.error("SKU Extraction Error:", e);
    }

    // 3. Print SKU on the label (Bottom-Left of the cropped area)
    // Coordinate (40, 40) relative to bottom of original page, but we are cropped
    // So we position it relative to the crop box
    copiedPage.drawText(`SKU: ${sku}`, {
      x: 30,
      y: cropY + 20,
      size: 18,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    newPdf.addPage(copiedPage);
  }

  return await newPdf.save();
}
