import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, findOrderColumns, findPaymentColumns, findAdsColumns, parseNumeric, parseDate } from '@/lib/reconciliation/csv-parser';
import { validateOrderCSV, validatePaymentCSV, validateAdsCSV } from '@/lib/reconciliation/validator';
import {
  calculateFileHash,
  checkDuplicateUpload,
  createUploadRecord,
  insertOrdersRaw,
  insertPaymentsRaw,
  insertAdsRaw,
  recordImportErrors,
  updateUploadStatus
} from '@/lib/reconciliation/importer';
import { processReconciliation } from '@/lib/reconciliation/reconciliation-engine';

export const revalidate = 0;

interface UploadRequest {
  file: File;
  sourceType: 'order' | 'payment' | 'ads';
  accountId: string;
}

/**
 * POST /api/reconciliation/upload
 * Handles CSV upload for Orders, Payments, or RM Ads
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceType = formData.get('sourceType') as string;
    const accountId = request.headers.get('x-account-id');

    // Validation
    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }

    if (!['order', 'payment', 'ads'].includes(sourceType)) {
      return NextResponse.json({ success: false, message: 'Invalid source type' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
    }

    // Read file content
    const fileContent = await file.text();
    if (!fileContent.trim()) {
      return NextResponse.json({ success: false, message: 'CSV file is empty' }, { status: 400 });
    }

    // Parse CSV
    let csvData;
    try {
      csvData = parseCSV(fileContent);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, message: `CSV parsing error: ${error.message}` },
        { status: 400 }
      );
    }

    // Calculate file hash for duplicate detection
    const fileHash = calculateFileHash(fileContent);

    // Check for duplicate
    const isDuplicate = await checkDuplicateUpload(fileHash, 'Meesho', sourceType);
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          message: 'This file has already been uploaded. Duplicate uploads are not allowed to prevent data duplication.',
          isDuplicate: true
        },
        { status: 409 }
      );
    }

    // Validate headers and structure
    let validationResult;
    if (sourceType === 'order') {
      validationResult = validateOrderCSV(csvData);
    } else if (sourceType === 'payment') {
      validationResult = validatePaymentCSV(csvData);
    } else {
      validationResult = validateAdsCSV(csvData);
    }

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'CSV validation failed',
          errors: validationResult.errors
        },
        { status: 400 }
      );
    }

    // Create upload record
    const uploadRecord = await createUploadRecord(
      'Meesho',
      sourceType as 'order' | 'payment' | 'ads',
      file.name,
      fileHash,
      csvData.rows.length,
      accountId
    );

    // Process rows based on source type
    let importResult;
    const processedRows: Array<{
      rowNumber: number;
      data: Record<string, any>;
      raw: Record<string, any>;
    }> = [];

    for (const row of csvData.rows) {
      const processedRow = processRowData(row, validationResult.headerMapping, sourceType);
      if (processedRow) {
        processedRows.push(processedRow);
      }
    }

    // Insert raw data
    if (sourceType === 'order') {
      importResult = await insertOrdersRaw(uploadRecord.id, processedRows);
    } else if (sourceType === 'payment') {
      importResult = await insertPaymentsRaw(uploadRecord.id, processedRows);
    } else {
      importResult = await insertAdsRaw(uploadRecord.id, processedRows);
    }

    // Record any errors
    const errorRows = csvData.rows.filter((row, idx) =>
      validationResult.errors.some((err) => err.rowNumber === row.rowNumber)
    );

    if (validationResult.errors.length > 0) {
      await recordImportErrors(
        uploadRecord.id,
        validationResult.errors.map((err) => ({
          rowNumber: err.rowNumber || 0,
          field: err.field,
          message: err.message
        }))
      );
    }

    // Update upload status
    const hasErrors = importResult.errorIds.length > 0 || validationResult.errors.length > 0;
    await updateUploadStatus(
      uploadRecord.id,
      hasErrors ? 'completed_with_errors' : 'completed',
      importResult.successCount,
      importResult.errorIds.length + validationResult.errors.length,
      {
        validationWarnings: validationResult.warnings.length,
        totalRows: csvData.rows.length
      }
    );

    // Trigger reconciliation processing
    try {
      await processReconciliation(uploadRecord.id);
    } catch (error: any) {
      console.error('Reconciliation processing error:', error);
    }

    return NextResponse.json(
      {
        success: true,
        uploadId: uploadRecord.id,
        message: hasErrors ? 'Upload completed with errors' : 'Upload completed successfully',
        stats: {
          totalRows: csvData.rows.length,
          successfulRows: importResult.successCount,
          failedRows: importResult.errorIds.length,
          validationWarnings: validationResult.warnings.length,
          sourceType
        },
        errors: validationResult.errors,
        warnings: validationResult.warnings
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error during upload processing',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Process a single row based on source type
 */
function processRowData(
  row: { rowNumber: number; values: string[]; parsed: Record<string, any> },
  headerMapping: Record<string, number>,
  sourceType: string
): {
  rowNumber: number;
  data: Record<string, any>;
  raw: Record<string, any>;
} | null {
  const raw = row.parsed;
  const data: Record<string, any> = {};

  if (sourceType === 'order') {
    data.subOrderNo = getString(row.values, headerMapping['subOrderNo']);
    data.catalogId = getString(row.values, headerMapping['catalogId']);
    data.orderDate = row.values[headerMapping['orderDate']] || null;
    data.orderSource = getString(row.values, headerMapping['orderSource']);
    data.customerState = getString(row.values, headerMapping['customerState']);
    data.productName = getString(row.values, headerMapping['productName']);
    data.sku = getString(row.values, headerMapping['sku']);
    data.size = getString(row.values, headerMapping['size']);
    data.quantity = parseNumeric(row.values[headerMapping['quantity']]);
    data.supplierListedPrice = parseNumeric(row.values[headerMapping['supplierListedPrice']]);
    data.supplierDiscountedPrice = parseNumeric(row.values[headerMapping['supplierDiscountedPrice']]);
    data.packetId = getString(row.values, headerMapping['packetId']);
  } else if (sourceType === 'payment') {
    data.subOrderNo = getString(row.values, headerMapping['subOrderNo']);
    data.orderNo = getString(row.values, headerMapping['orderNo']);
    data.transactionId = getString(row.values, headerMapping['transactionId']);
    data.orderDate = row.values[headerMapping['orderDate']] || null;
    data.dispatchDate = row.values[headerMapping['dispatchDate']] || null;
    data.paymentDate = row.values[headerMapping['paymentDate']] || null;
    data.productName = getString(row.values, headerMapping['productName']);
    data.supplierSku = getString(row.values, headerMapping['supplierSku']);
    data.quantity = parseNumeric(row.values[headerMapping['quantity']]);
    data.finalSettlementAmount = parseNumeric(row.values[headerMapping['finalSettlementAmount']]);
    data.totalSaleAmount = parseNumeric(row.values[headerMapping['totalSaleAmount']]);
    data.totalSaleReturnAmount = parseNumeric(row.values[headerMapping['totalSaleReturnAmount']]);
    data.liveOrderStatus = getString(row.values, headerMapping['liveOrderStatus']);
    data.shippingCharge = parseNumeric(row.values[headerMapping['shippingCharge']]);
    data.returnShippingCharge = parseNumeric(row.values[headerMapping['returnShippingCharge']]);
    data.tcs = parseNumeric(row.values[headerMapping['tcs']]);
    data.tds = parseNumeric(row.values[headerMapping['tds']]);
    data.tdsRate = parseNumeric(row.values[headerMapping['tdsRate']]);
    data.fixedFee = parseNumeric(row.values[headerMapping['fixedFee']]);
    data.commission = parseNumeric(row.values[headerMapping['commission']]);
    data.commissionPercentage = parseNumeric(row.values[headerMapping['commissionPercentage']]);
    data.warehousingFee = parseNumeric(row.values[headerMapping['warehousingFee']]);
    data.goldPlatformFee = parseNumeric(row.values[headerMapping['goldPlatformFee']]);
    data.mallPlatformFee = parseNumeric(row.values[headerMapping['mallPlatformFee']]);
    data.returnPremium = parseNumeric(row.values[headerMapping['returnPremium']]);
    data.returnPremiumOfReturn = parseNumeric(row.values[headerMapping['returnPremiumOfReturn']]);
    data.gstCompensation = parseNumeric(row.values[headerMapping['gstCompensation']]);
    data.otherSupportServiceCharges = parseNumeric(row.values[headerMapping['otherSupportServiceCharges']]);
    data.waivers = parseNumeric(row.values[headerMapping['waivers']]);
    data.netOtherSupportServiceCharges = parseNumeric(row.values[headerMapping['netOtherSupportServiceCharges']]);
    data.gstOnNetOtherSupportServiceCharges = parseNumeric(row.values[headerMapping['gstOnNetOtherSupportServiceCharges']]);
    data.compensation = parseNumeric(row.values[headerMapping['compensation']]);
    data.claims = parseNumeric(row.values[headerMapping['claims']]);
    data.recovery = parseNumeric(row.values[headerMapping['recovery']]);
    data.claimsReason = getString(row.values, headerMapping['claimsReason']);
    data.compensationReason = getString(row.values, headerMapping['compensationReason']);
    data.recoveryReason = getString(row.values, headerMapping['recoveryReason']);
  } else if (sourceType === 'ads') {
    data.deductionDuration = getString(row.values, headerMapping['deductionDuration']);
    data.deductionDate = row.values[headerMapping['deductionDate']] || null;
    data.campaignId = getString(row.values, headerMapping['campaignId']);
    data.adCost = parseNumeric(row.values[headerMapping['adCost']]);
    data.creditsWaivers = parseNumeric(row.values[headerMapping['creditsWaivers']]);
    data.adCostInclCredits = parseNumeric(row.values[headerMapping['adCostInclCredits']]);
    data.gst = parseNumeric(row.values[headerMapping['gst']]);
    data.totalAdsCost = parseNumeric(row.values[headerMapping['totalAdsCost']]);
  }

  return { rowNumber: row.rowNumber, data, raw };
}

/**
 * Get string value safely
 */
function getString(values: string[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const value = values[index]?.trim();
  return value && value !== '' ? value : null;
}
