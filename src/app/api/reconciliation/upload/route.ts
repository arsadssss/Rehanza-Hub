import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, parseNumeric } from '@/lib/reconciliation/csv-parser';
import { validateOrderCSV, validatePaymentCSV, validateAdsCSV } from '@/lib/reconciliation/validator';
import {
  calculateFileHash,
  calculateRowHash,
  getExistingRowHashes,
  createUploadRecord,
  insertOrdersRaw,
  insertPaymentsRaw,
  insertAdsRaw,
  recordImportErrors,
  updateUploadStatus,
  ProcessedRow
} from '@/lib/reconciliation/importer';
import { rebuildAccountReconciliation } from '@/lib/reconciliation/reconciliation-engine';
import { syncSkusFromOrders } from '@/lib/reconciliation/sku-master-service';
import { syncSkusFromReconciliation } from '@/lib/products/sku-registry-service';

export const revalidate = 0;

interface ProgressEvent {
  stage: string;
  percent: number;
  current?: number;
  total?: number;
  message: string;
}

interface UploadPipelineParams {
  file: File;
  sourceType: 'order' | 'payment' | 'ads';
  accountId: string;
  onProgress?: (event: ProgressEvent) => void;
}

interface UploadPipelineResult {
  success: boolean;
  uploadId?: number;
  message: string;
  isDuplicate?: boolean;
  allDuplicates?: boolean;
  stats: {
    totalRows: number;
    successfulRows: number;
    importedRows: number;
    duplicateRows: number;
    failedRows: number;
    validationWarnings: number;
    sourceType: string;
  };
  skuCostStatus?: any;
  errors?: any[];
  warnings?: any[];
}

/**
 * Executes the complete reconciliation file upload pipeline.
 * Performs row-level duplicate detection, batch insertions, transaction rebuilding,
 * and live stage-by-stage progress reporting.
 */
export async function executeUploadPipeline({
  file,
  sourceType,
  accountId,
  onProgress,
}: UploadPipelineParams): Promise<UploadPipelineResult> {
  // --- Stage 1: Reading file ---
  onProgress?.({
    stage: 'Reading file',
    percent: 10,
    message: 'Reading and parsing reconciliation CSV export...',
  });

  const fileContent = await file.text();
  if (!fileContent.trim()) {
    throw new Error('CSV file is empty');
  }

  let csvData;
  try {
    csvData = parseCSV(fileContent, sourceType);
  } catch (error: any) {
    throw new Error(`CSV parsing error: ${error.message}`);
  }

  const fileHash = calculateFileHash(fileContent);

  // --- Stage 2: Validating rows ---
  onProgress?.({
    stage: 'Validating rows',
    percent: 25,
    current: csvData.rows.length,
    total: csvData.rows.length,
    message: `Validating headers and structure across ${csvData.rows.length} rows...`,
  });

  let validationResult;
  if (sourceType === 'order') {
    validationResult = validateOrderCSV(csvData);
  } else if (sourceType === 'payment') {
    validationResult = validatePaymentCSV(csvData);
  } else {
    validationResult = validateAdsCSV(csvData);
  }

  if (!validationResult.isValid) {
    const detailedMessage = formatValidationErrorMessage(validationResult.errors);
    const err: any = new Error(detailedMessage);
    err.validationErrors = validationResult.errors;
    err.validationWarnings = validationResult.warnings;
    throw err;
  }

  // Process rows into standard structure
  const processedRows: ProcessedRow[] = [];
  for (const row of csvData.rows) {
    const processedRow = processRowData(row, validationResult.headerMapping, sourceType);
    if (processedRow) {
      processedRows.push(processedRow);
    }
  }

  // --- Stage 3: Checking duplicates (Row-Level SHA-256 Deduplication) ---
  onProgress?.({
    stage: 'Checking duplicates',
    percent: 38,
    message: 'Comparing rows against existing account data using SHA-256...',
  });

  const { hashes: existingHashes } = await getExistingRowHashes(
    accountId,
    sourceType
  );

  const newRows: ProcessedRow[] = [];
  const duplicateRows: ProcessedRow[] = [];
  const seenInBatch = new Set<string>();

  for (const row of processedRows) {
    const hash = calculateRowHash(sourceType, row.data);
    row.rowHash = hash;

    const isDup = existingHashes.has(hash) || seenInBatch.has(hash);

    if (isDup) {
      duplicateRows.push(row);
    } else {
      newRows.push(row);
      seenInBatch.add(hash);
    }
  }

  // SCENARIO A: All rows already present
  if (newRows.length === 0) {
    onProgress?.({
      stage: 'Finalizing',
      percent: 90,
      message: 'All records were already present. Updating upload audit record...',
    });

    const uploadRecord = await createUploadRecord(
      'Meesho',
      sourceType,
      file.name,
      fileHash,
      csvData.rows.length,
      accountId
    );

    await updateUploadStatus(
      uploadRecord.id,
      'completed',
      0,
      validationResult.errors.length,
      duplicateRows.length,
      {
        allDuplicates: true,
        duplicateCount: duplicateRows.length,
        importedCount: 0,
        totalRows: csvData.rows.length,
        validationWarnings: validationResult.warnings.length,
      }
    );

    onProgress?.({
      stage: 'Completed',
      percent: 100,
      message: 'No new records to import. All records were already present.',
    });

    return {
      success: true,
      uploadId: uploadRecord.id,
      message: 'No new records to import. All records were already present.',
      isDuplicate: true,
      allDuplicates: true,
      stats: {
        totalRows: csvData.rows.length,
        successfulRows: 0,
        importedRows: 0,
        duplicateRows: duplicateRows.length,
        failedRows: validationResult.errors.length,
        validationWarnings: validationResult.warnings.length,
        sourceType,
      },
      warnings: validationResult.warnings,
    };
  }

  // SCENARIO B: Some or all new rows to import
  const uploadRecord = await createUploadRecord(
    'Meesho',
    sourceType,
    file.name,
    fileHash,
    csvData.rows.length,
    accountId
  );

  // --- Stage 4: Importing records ---
  onProgress?.({
    stage: 'Importing records',
    percent: 45,
    current: 0,
    total: newRows.length,
    message: `Importing ${newRows.length} new records in batches...`,
  });

  let importResult: {
    successCount: number;
    errorIds: number[];
    errors: Array<{ rowNumber: number; field: string; message: string }>;
  };

  if (sourceType === 'order') {
    importResult = await insertOrdersRaw(uploadRecord.id, newRows, accountId, (processed, total) => {
      const pct = 45 + Math.round((processed / total) * 30);
      onProgress?.({
        stage: 'Importing records',
        percent: Math.min(75, pct),
        current: processed,
        total,
        message: `Importing records (${processed} / ${total} rows)...`,
      });
    });
  } else if (sourceType === 'payment') {
    importResult = await insertPaymentsRaw(uploadRecord.id, newRows, accountId, (processed, total) => {
      const pct = 45 + Math.round((processed / total) * 30);
      onProgress?.({
        stage: 'Importing records',
        percent: Math.min(75, pct),
        current: processed,
        total,
        message: `Importing records (${processed} / ${total} rows)...`,
      });
    });
  } else {
    importResult = await insertAdsRaw(uploadRecord.id, newRows, accountId, (processed, total) => {
      const pct = 45 + Math.round((processed / total) * 30);
      onProgress?.({
        stage: 'Importing records',
        percent: Math.min(75, pct),
        current: processed,
        total,
        message: `Importing records (${processed} / ${total} rows)...`,
      });
    });
  }

  // Auto-detect and sync SKUs into SKU Cost Master on order upload
  let skuCostStatus = null;
  if (sourceType === 'order') {
    try {
      const orderSkus = newRows.map((r) => ({
        sku: r.data.sku,
        productName: r.data.productName,
      }));
      skuCostStatus = await syncSkusFromOrders(accountId, orderSkus);
    } catch (skuErr) {
      console.error('Error auto-syncing SKUs from orders upload:', skuErr);
    }
  }

  // Combine validation errors and database insert errors for audit trail
  const allRowErrors = [
    ...validationResult.errors.map((err) => ({
      rowNumber: err.rowNumber || 0,
      field: err.field || 'Validation',
      message: err.message,
    })),
    ...(importResult.errors || []).map((err) => ({
      rowNumber: err.rowNumber || 0,
      field: err.field || 'Database Import',
      message: err.message,
    })),
  ];

  if (allRowErrors.length > 0) {
    await recordImportErrors(uploadRecord.id, allRowErrors);
  }

  // --- Stage 5: Building reconciliation transactions ---
  onProgress?.({
    stage: 'Building reconciliation transactions',
    percent: 78,
    message: 'Building authoritative Working Sheet transactions...',
  });

  try {
    await rebuildAccountReconciliation(accountId, (inserted, total) => {
      const pct = 78 + Math.round((inserted / (total || 1)) * 17);
      onProgress?.({
        stage: 'Building reconciliation transactions',
        percent: Math.min(95, pct),
        current: inserted,
        total,
        message: `Reconciling transactions (${inserted} / ${total})...`,
      });
    });
  } catch (reconErr) {
    console.error('Reconciliation transaction rebuild error:', reconErr);
  }

  // Auto-sync discovered SKUs into Products Registry
  try {
    await syncSkusFromReconciliation(accountId);
  } catch (skuSyncErr) {
    console.error('Auto-syncing SKUs to product registry error:', skuSyncErr);
  }

  // --- Stage 6: Finalizing ---
  onProgress?.({
    stage: 'Finalizing',
    percent: 96,
    message: 'Finalizing upload records and metrics...',
  });

  const hasErrors = allRowErrors.length > 0;
  const finalStatus = hasErrors ? 'completed_with_errors' : 'completed';

  await updateUploadStatus(
    uploadRecord.id,
    finalStatus,
    importResult.successCount,
    allRowErrors.length,
    duplicateRows.length,
    {
      totalRows: csvData.rows.length,
      importedRows: importResult.successCount,
      duplicateRows: duplicateRows.length,
      failedRows: allRowErrors.length,
      validationWarnings: validationResult.warnings.length,
    }
  );

  const message =
    duplicateRows.length > 0
      ? `${importResult.successCount} new rows imported, ${duplicateRows.length} duplicates skipped.`
      : hasErrors
      ? 'Upload completed with warnings.'
      : 'Upload completed successfully.';

  onProgress?.({
    stage: 'Completed',
    percent: 100,
    message,
  });

  return {
    success: true,
    uploadId: uploadRecord.id,
    message,
    isDuplicate: duplicateRows.length > 0,
    allDuplicates: false,
    stats: {
      totalRows: csvData.rows.length,
      successfulRows: importResult.successCount,
      importedRows: importResult.successCount,
      duplicateRows: duplicateRows.length,
      failedRows: allRowErrors.length,
      validationWarnings: validationResult.warnings.length,
      sourceType,
    },
    skuCostStatus,
    errors: allRowErrors,
    warnings: validationResult.warnings,
  };
}

/**
 * POST /api/reconciliation/upload
 * Handles CSV upload for Orders, Payments, or RM Ads with streaming or standard response
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

    // Check if client requested live streaming
    const wantsStream =
      request.nextUrl.searchParams.get('stream') === 'true' ||
      request.headers.get('accept')?.includes('application/x-ndjson') ||
      request.headers.get('accept')?.includes('text/event-stream');

    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          function send(obj: any) {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
            } catch (err) {
              console.warn('Stream enqueue error:', err);
            }
          }

          try {
            const result = await executeUploadPipeline({
              file,
              sourceType: sourceType as 'order' | 'payment' | 'ads',
              accountId,
              onProgress: (p) => send({ type: 'progress', ...p }),
            });
            send({ type: 'complete', ...result });
          } catch (err: any) {
            console.error('Upload stream pipeline error:', err);
            send({
              type: 'error',
              success: false,
              message: err.message || 'Server error during upload processing',
              errors: err.validationErrors || [],
              warnings: err.validationWarnings || [],
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    // Standard Non-Streaming JSON Execution
    try {
      const result = await executeUploadPipeline({
        file,
        sourceType: sourceType as 'order' | 'payment' | 'ads',
        accountId,
      });
      return NextResponse.json(result, { status: 200 });
    } catch (err: any) {
      if (err.validationErrors) {
        return NextResponse.json(
          {
            success: false,
            message: err.message,
            errors: err.validationErrors,
            warnings: err.validationWarnings,
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          message: err.message || 'Server error during upload processing',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Top-level upload route error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error during upload processing',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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
    data.reasonForCredit = getString(row.values, headerMapping['reasonForCredit']);
  } else if (sourceType === 'payment') {
    data.subOrderNo = getString(row.values, headerMapping['subOrderNo']);
    data.orderNo = getString(row.values, headerMapping['orderNo']);
    data.transactionId = getString(row.values, headerMapping['transactionId']);
    data.orderDate = row.values[headerMapping['orderDate']] || null;
    data.dispatchDate = row.values[headerMapping['dispatchDate']] || null;
    data.paymentDate = row.values[headerMapping['paymentDate']] || null;
    data.productName = getString(row.values, headerMapping['productName']);
    data.supplierSku = getString(row.values, headerMapping['supplierSku']);
    data.catalogId = getString(row.values, headerMapping['catalogId']);
    data.orderSource = getString(row.values, headerMapping['orderSource']);
    data.liveOrderStatus = getString(row.values, headerMapping['liveOrderStatus']);
    data.productGst = parseNumeric(row.values[headerMapping['productGstPercent']]);
    data.listingPrice = parseNumeric(row.values[headerMapping['listingPrice']]);
    data.quantity = parseNumeric(row.values[headerMapping['quantity']]);
    data.finalSettlementAmount = parseNumeric(row.values[headerMapping['finalSettlementAmount']]);
    data.priceType = getString(row.values, headerMapping['priceType']);
    data.totalSaleAmount = parseNumeric(row.values[headerMapping['totalSaleAmount']]);
    data.totalSaleReturnAmount = parseNumeric(row.values[headerMapping['totalSaleReturnAmount']]);
    data.fixedFee = parseNumeric(row.values[headerMapping['fixedFee']]);
    data.fixedFeeGst = parseNumeric(row.values[headerMapping['fixedFeeGst']]);
    data.warehousingFee = parseNumeric(row.values[headerMapping['warehousingFee']]);
    data.warehousingFeeGst = parseNumeric(row.values[headerMapping['warehousingFeeGst']]);
    data.returnPremium = parseNumeric(row.values[headerMapping['returnPremium']]);
    data.returnPremiumOfReturn = parseNumeric(row.values[headerMapping['returnPremiumOfReturn']]);
    data.commissionPercentage = parseNumeric(row.values[headerMapping['commissionPercentage']]);
    data.commission = parseNumeric(row.values[headerMapping['commission']]);
    data.goldPlatformFee = parseNumeric(row.values[headerMapping['goldPlatformFee']]);
    data.mallPlatformFee = parseNumeric(row.values[headerMapping['mallPlatformFee']]);
    data.returnShippingCharge = parseNumeric(row.values[headerMapping['returnShippingCharge']]);
    data.gstCompensation = parseNumeric(row.values[headerMapping['gstCompensation']]);
    data.shippingCharge = parseNumeric(row.values[headerMapping['shippingCharge']]);
    data.otherSupportServiceCharges = parseNumeric(row.values[headerMapping['otherSupportServiceCharges']]);
    data.waivers = parseNumeric(row.values[headerMapping['waivers']]);
    data.netOtherSupportServiceCharges = parseNumeric(row.values[headerMapping['netOtherSupportServiceCharges']]);
    data.gstOnNetOtherSupportServiceCharges = parseNumeric(row.values[headerMapping['gstOnNetOtherSupportServiceCharges']]);
    data.tcs = parseNumeric(row.values[headerMapping['tcs']]);
    data.tdsRate = parseNumeric(row.values[headerMapping['tdsRate']]);
    data.tds = parseNumeric(row.values[headerMapping['tds']]);
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
 * Format human-readable validation error summary
 */
function formatValidationErrorMessage(errors: Array<{ rowNumber?: number; field?: string; message: string }>): string {
  if (!errors || errors.length === 0) {
    return 'CSV validation failed';
  }

  // 1. Missing header errors
  const missingHeaderErr = errors.find((e) =>
    e.message.toLowerCase().includes('required header not found')
  );
  if (missingHeaderErr) {
    const rawCol = missingHeaderErr.field || missingHeaderErr.message.replace(/.*:\s*/, '').trim();
    const friendlyCols: Record<string, string> = {
      subOrderNo: 'Sub Order No',
      sku: 'SKU',
      quantity: 'Quantity',
      orderDate: 'Order Date',
      transactionId: 'Transaction ID',
      finalSettlementAmount: 'Final Settlement Amount',
      campaignId: 'Campaign ID',
      adCost: 'Ad Cost',
      deductionDate: 'Deduction Date',
    };
    const colName = friendlyCols[rawCol] || rawCol;
    return `CSV validation failed: Required column "${colName}" is missing`;
  }

  // 2. Count errors by field
  const fieldCounts: Record<string, number> = {};
  for (const err of errors) {
    const key = err.field || 'General';
    fieldCounts[key] = (fieldCounts[key] || 0) + 1;
  }

  const topField = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])[0];
  if (topField) {
    const [field, count] = topField;
    const friendlyFieldNames: Record<string, string> = {
      quantity: 'Quantity values',
      subOrderNo: 'Sub Order No values',
      sku: 'SKU values',
      orderDate: 'Order Date values',
      supplierListedPrice: 'Supplier Listed Price values',
      supplierDiscountedPrice: 'Supplier Discounted Price values',
      finalSettlementAmount: 'Final Settlement Amount values',
      transactionId: 'Transaction ID values',
      adCost: 'Ad Cost values',
      campaignId: 'Campaign ID values',
      deductionDate: 'Deduction Date values',
    };
    const fieldName = friendlyFieldNames[field] || `${field} values`;
    return `CSV validation failed: ${count} ${count === 1 ? 'row has' : 'rows have'} invalid ${fieldName}`;
  }

  return `CSV validation failed: ${errors[0].message}`;
}

/**
 * Get string value safely
 */
function getString(values: string[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const raw = values[index];
  if (raw === undefined || raw === null) return null;
  const value = String(raw).replace(/^["']|["']$/g, '').trim();
  return value && value !== '' ? value : null;
}
