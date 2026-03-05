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
 * 1. Iterates in pairs (Label + Invoice).
 * 2. Extracts SKU from the invoice page.
 * 3. Keeps only the label page at original size.
 * 4. Clears existing footer and prints new footer with SKU.
 */
export async function processAmazonLabels(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();
  const newPdf = await PDFDocument.create();
  const fontBold = await newPdf.embedFont(StandardFonts.HelveticaBold);

  // Load PDF for text extraction using pdfjs
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfJsDoc = await loadingTask.promise;

  for (let i = 0; i < totalPages; i += 2) {
    const labelIndex = i;
    const invoiceIndex = i + 1;

    // 1. Copy Label Page (DO NOT crop or resize)
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [labelIndex]);

    // 2. Extract SKU from the corresponding Invoice Page
    let sku = "SKU NOT FOUND";
    if (invoiceIndex < totalPages) {
      try {
        const pageJs = await pdfJsDoc.getPage(invoiceIndex + 1);
        const textContent = await pageJs.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        
        // Amazon SKU regex: Only capture parentheses immediately before the word HSN
        const skuMatch = text.match(/\(\s*([A-Za-z0-9\-]+)\s*\)\s*HSN/i);
        if (skuMatch && skuMatch[1]) {
          sku = skuMatch[1].trim();
        }
      } catch (e) {
        console.error("SKU Extraction Error from Invoice:", e);
      }
    }

    // 3. Clear existing footer area and print SKU appended to footer text
    
    // Draw white rectangle to hide existing footer
    copiedPage.drawRectangle({
      x: 45,
      y: 30,
      width: 420,
      height: 22,
      color: rgb(1, 1, 1)
    });

    const newFooter = `Sold on: www.amazon.in | ${sku}`;

    copiedPage.drawText(newFooter, {
      x: 50,
      y: 35,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0)
    });

    newPdf.addPage(copiedPage);
  }

  return await newPdf.save();
}
