import Papa from 'papaparse';

/**
 * CSV Parser for Meesho Reconciliation
 * Handles three file types: Order, Payments, RM Ads
 */

export interface ParsedCSVRow {
  rowNumber: number;
  headers: string[];
  data: Record<string, any>;
  rawCSVLine?: string;
}

/**
 * Normalize header names for flexible matching
 * Removes extra whitespace, handles variations and quotes
 */
function normalizeHeader(header: string): string {
  return header
    .replace(/^["']|["']$/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const ORDER_SIGNATURES = [
  'reason for credit entry', 'sub order no', 'catalog id', 'order date',
  'order source', 'customer state', 'product name', 'sku', 'size', 'quantity',
  'supplier listed price', 'supplier discounted price', 'packet id'
];

const PAYMENT_SIGNATURES = [
  'sub order no', 'transaction id', 'final settlement amount', 'payment date',
  'total sale amount', 'live order status', 'supplier sku', 'dispatch date',
  'tcs', 'tds', 'shipping charge', 'commission'
];

const ADS_SIGNATURES = [
  'deduction duration', 'deduction date', 'campaign id', 'ad cost',
  'credits / waivers / discounts', 'total ads cost', 'gst', 'ad cost incl'
];

/**
 * Score a candidate row against source signatures
 */
function scoreRowForType(row: string[], type: 'order' | 'payment' | 'ads'): number {
  if (!row || row.length === 0) return 0;
  const normalized = row.map(normalizeHeader).filter(Boolean);
  const signatures = type === 'order' ? ORDER_SIGNATURES : type === 'payment' ? PAYMENT_SIGNATURES : ADS_SIGNATURES;
  let score = 0;

  for (const sig of signatures) {
    for (const cell of normalized) {
      if (cell === sig) {
        score += 2; // Exact match
        break;
      } else if (cell.includes(sig)) {
        // Negative guards to prevent cross-column misattribution
        if (sig === 'commission' && cell.includes('percentage')) continue;
        if (sig === 'shipping charge' && cell.includes('return')) continue;
        if (sig === 'ad cost' && cell.includes('incl')) continue;
        if (sig === 'price' && cell.includes('discounted')) continue;
        score += 1;
        break;
      }
    }
  }
  return score;
}

/**
 * Identify formula, calculation, or helper metadata rows in Meesho exports
 */
export function isFormulaOrMetadataRow(values: string[]): boolean {
  let formulaCount = 0;
  for (const v of values) {
    const trimmed = String(v || '').trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase().includes('track which orders') || trimmed.toLowerCase().includes('formula')) {
      return true;
    }
    // Matches patterns like (A + B), (B + C + ...), P = L * 18 / 100
    if (/^\(?[A-Z0-9\s+*\/=-]+\)?$/.test(trimmed) && /[+=*\/]/.test(trimmed)) {
      formulaCount++;
    } else if (/^[A-Z]{1,2}$/.test(trimmed)) {
      formulaCount++;
    }
  }
  return formulaCount >= 2;
}

/**
 * Parse CSV text into structured data using PapaParse with multi-row header detection
 * Correctly handles multi-row headers, group labels, metadata/formula rows, and RFC 4180 quotes
 */
export function parseCSV(
  csvText: string,
  expectedSourceType?: 'order' | 'payment' | 'ads'
): {
  headers: string[];
  rows: Array<{ rowNumber: number; values: string[]; parsed: Record<string, any> }>;
  rawLines: string[];
  detectedType: 'order' | 'payment' | 'ads' | 'unknown';
  headerRowIndex: number;
  dataStartRow: number;
  skippedMetadataRows: number;
} {
  if (!csvText || !csvText.trim()) {
    throw new Error('CSV file is empty');
  }

  // Remove UTF-8 BOM if present
  const cleanText = csvText.replace(/^\uFEFF/, '');

  const parseResult = Papa.parse<string[]>(cleanText, {
    skipEmptyLines: 'greedy',
  });

  const allRows = parseResult.data;
  if (!allRows || allRows.length === 0) {
    throw new Error('CSV file is empty');
  }

  // 1. Determine header row index and source type across first candidate rows
  const candidateLimit = Math.min(10, allRows.length);
  let detectedType: 'order' | 'payment' | 'ads' | 'unknown' = expectedSourceType || 'unknown';
  let bestHeaderRowIndex = 0;
  let highestScore = 0;

  if (expectedSourceType) {
    for (let i = 0; i < candidateLimit; i++) {
      const score = scoreRowForType(allRows[i], expectedSourceType);
      if (score > highestScore) {
        highestScore = score;
        bestHeaderRowIndex = i;
      }
    }
  } else {
    const types: Array<'order' | 'payment' | 'ads'> = ['order', 'payment', 'ads'];
    for (const t of types) {
      for (let i = 0; i < candidateLimit; i++) {
        const score = scoreRowForType(allRows[i], t);
        if (score > highestScore) {
          highestScore = score;
          bestHeaderRowIndex = i;
          detectedType = t;
        }
      }
    }
  }

  const rawHeaders = allRows[bestHeaderRowIndex] || [];
  const headers = rawHeaders.map((h: any) =>
    h !== undefined && h !== null ? String(h).replace(/^["']|["']$/g, '').trim() : ''
  );

  if (headers.every((h: string) => h === '')) {
    throw new Error('CSV file is empty');
  }

  // 2. Parse data rows after the header, skipping formula/instruction metadata rows
  const rows: Array<{ rowNumber: number; values: string[]; parsed: Record<string, any> }> = [];
  const rawLines = cleanText.split(/\r?\n/).filter((line) => line.trim());
  let skippedMetadataRows = 0;

  for (let i = bestHeaderRowIndex + 1; i < allRows.length; i++) {
    const rawValues = allRows[i];
    if (!rawValues || (rawValues.length === 1 && String(rawValues[0]).trim() === '')) {
      continue;
    }

    const values = rawValues.map((v: any) =>
      v !== undefined && v !== null ? String(v).replace(/^["']|["']$/g, '').trim() : ''
    );

    // Filter out formula / metadata helper rows (e.g. Row 3 in Payments or RM Ads)
    if (isFormulaOrMetadataRow(values)) {
      skippedMetadataRows++;
      continue;
    }

    const parsed: Record<string, any> = {};
    headers.forEach((header: string, idx: number) => {
      parsed[header] = values[idx] || '';
    });

    rows.push({
      rowNumber: i + 1, // 1-indexed file line number
      values,
      parsed,
    });
  }

  return {
    headers,
    rows,
    rawLines,
    detectedType,
    headerRowIndex: bestHeaderRowIndex,
    dataStartRow: bestHeaderRowIndex + 1 + skippedMetadataRows + 1,
    skippedMetadataRows,
  };
}

/**
 * Map CSV headers for Order upload
 */
export function findOrderColumns(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const mapping: Record<string, number> = {};

  const columnMappings: Record<string, string[]> = {
    'reasonForCredit': ['reason for credit entry', 'reason'],
    'subOrderNo': ['sub order no', 'sub order number', 'sub_order_no'],
    'catalogId': ['catalog id', 'catalog'],
    'orderDate': ['order date', 'orderdate'],
    'orderSource': ['order source', 'source'],
    'customerState': ['customer state', 'state'],
    'productName': ['product name', 'name'],
    'sku': ['sku', 'supplier sku', 'product sku'],
    'size': ['size', 'product size'],
    'quantity': ['quantity', 'qty'],
    'supplierListedPrice': ['supplier listed price', 'listing price', 'supplier price'],
    'supplierDiscountedPrice': ['supplier discounted price', 'discounted price'],
    'packetId': ['packet id', 'packet', 'transaction id']
  };

  for (const [key, aliases] of Object.entries(columnMappings)) {
    let foundIdx = -1;
    for (const alias of aliases) {
      const idx = normalized.findIndex(h => h === alias);
      if (idx !== -1) {
        foundIdx = idx;
        break;
      }
    }
    if (foundIdx === -1) {
      for (let i = 0; i < normalized.length; i++) {
        if (aliases.some(alias => normalized[i].includes(alias))) {
          foundIdx = i;
          break;
        }
      }
    }
    if (foundIdx !== -1) {
      mapping[key] = foundIdx;
    }
  }

  return mapping;
}

/**
 * Map CSV headers for Payment upload
 */
export function findPaymentColumns(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const mapping: Record<string, number> = {};

  const columnMappings: Record<string, string[]> = {
    'subOrderNo': ['sub order no', 'sub order number'],
    'orderDate': ['order date'],
    'dispatchDate': ['dispatch date'],
    'productName': ['product name'],
    'supplierSku': ['supplier sku', 'sku'],
    'catalogId': ['catalog id'],
    'orderSource': ['order source'],
    'liveOrderStatus': ['live order status'],
    'productGstPercent': ['product gst %', 'product gst percent', 'gst %'],
    'listingPrice': ['listing price (incl. taxes)', 'listing price'],
    'quantity': ['quantity', 'qty'],
    'transactionId': ['transaction id', 'transaction'],
    'paymentDate': ['payment date'],
    'finalSettlementAmount': ['final settlement amount'],
    'priceType': ['price type'],
    'totalSaleAmount': ['total sale amount (incl. shipping & gst)', 'total sale amount'],
    'totalSaleReturnAmount': ['total sale return amount (incl. shipping & gst)', 'total sale return amount'],
    'fixedFee': ['fixed fee (incl. gst)', 'fixed fee'],
    'warehousingFee': ['warehousing fee (inc gst)', 'warehousing fee (incl. gst)', 'warehousing fee'],
    'returnPremium': ['return premium (incl gst)', 'return premium'],
    'returnPremiumOfReturn': ['return premium (incl gst) of return', 'return premium of return'],
    'commissionPercentage': ['meesho commission percentage', 'commission percentage'],
    'commission': ['meesho commission (incl. gst)', 'meesho commission'],
    'goldPlatformFee': ['meesho gold platform fee (incl. gst)', 'meesho gold platform fee', 'gold platform fee'],
    'mallPlatformFee': ['meesho mall platform fee (incl. gst)', 'meesho mall platform fee', 'mall platform fee'],
    'returnShippingCharge': ['return shipping charge (incl. gst)', 'return shipping charge'],
    'gstCompensation': ['gst compensation (prp shipping)', 'gst compensation'],
    'shippingCharge': ['shipping charge (incl. gst)', 'shipping charge'],
    'otherSupportServiceCharges': ['other support service charges (excl. gst)', 'other support service charges'],
    'waivers': ['waivers (excl. gst)', 'waivers'],
    'netOtherSupportServiceCharges': ['net other support service charges (excl. gst)', 'net other support service charges'],
    'gstOnNetOtherSupportServiceCharges': ['gst on net other support service charges'],
    'tcs': ['tcs'],
    'tdsRate': ['tds rate %', 'tds rate'],
    'tds': ['tds'],
    'compensation': ['compensation'],
    'claims': ['claims'],
    'recovery': ['recovery'],
    'compensationReason': ['compensation reason'],
    'claimsReason': ['claims reason'],
    'recoveryReason': ['recovery reason']
  };

  // 1. Exact matches first
  for (const [key, aliases] of Object.entries(columnMappings)) {
    for (const alias of aliases) {
      const idx = normalized.findIndex(h => h === alias);
      if (idx !== -1) {
        mapping[key] = idx;
        break;
      }
    }
  }

  // 2. Controlled substring matches with negative guards
  for (const [key, aliases] of Object.entries(columnMappings)) {
    if (mapping[key] !== undefined) continue;

    for (const alias of aliases) {
      const idx = normalized.findIndex((h) => {
        if (!h.includes(alias)) return false;
        // Negative guards
        if (key === 'commission' && h.includes('percentage')) return false;
        if (key === 'shippingCharge' && h.includes('return')) return false;
        if (key === 'returnPremium' && h.includes('of return')) return false;
        return true;
      });

      if (idx !== -1) {
        mapping[key] = idx;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Map CSV headers for RM Ads upload
 */
export function findAdsColumns(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const mapping: Record<string, number> = {};

  const columnMappings: Record<string, string[]> = {
    'deductionDuration': ['deduction duration'],
    'deductionDate': ['deduction date'],
    'campaignId': ['campaign id'],
    'adCost': ['ad cost', 'cost'],
    'creditsWaivers': ['credits / waivers / discounts', 'credits/waivers/discounts'],
    'adCostInclCredits': ['ad cost incl. credits/waivers/discounts', 'ad cost incl'],
    'gst': ['gst'],
    'totalAdsCost': ['total ads cost']
  };

  // 1. Exact matches first
  for (const [key, aliases] of Object.entries(columnMappings)) {
    for (const alias of aliases) {
      const idx = normalized.findIndex(h => h === alias);
      if (idx !== -1) {
        mapping[key] = idx;
        break;
      }
    }
  }

  // 2. Controlled substring matches with negative guards
  for (const [key, aliases] of Object.entries(columnMappings)) {
    if (mapping[key] !== undefined) continue;

    for (const alias of aliases) {
      const idx = normalized.findIndex((h) => {
        if (!h.includes(alias)) return false;
        if (key === 'adCost' && h.includes('incl')) return false;
        return true;
      });

      if (idx !== -1) {
        mapping[key] = idx;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Parse numeric value safely
 * Handles strings with surrounding quotes, commas, or currency symbols
 */
export function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/['",₹$]/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'na' || cleaned.toLowerCase() === 'n/a') {
      return null;
    }
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse date value safely
 * Supports standard formats, ISO strings, and DD-MM-YYYY / DD/MM/YYYY
 */
export function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/^["']|["']$/g, '').trim();
    if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'null') {
      return null;
    }

    // Direct parse
    let date = new Date(cleaned);
    if (!isNaN(date.getTime())) return date;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) return date;
    }
    return null;
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse boolean value
 */
export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
  }
  return Boolean(value);
}

/**
 * Automatically detects the Meesho reconciliation file type across candidate rows
 */
export function detectCsvFileTypeFromRows(candidateRows: string[][]): 'order' | 'payment' | 'ads' | 'unknown' {
  if (!candidateRows || candidateRows.length === 0) return 'unknown';

  let bestType: 'order' | 'payment' | 'ads' | 'unknown' = 'unknown';
  let highestScore = 0;

  const types: Array<'order' | 'payment' | 'ads'> = ['payment', 'ads', 'order'];
  const limit = Math.min(10, candidateRows.length);

  for (const t of types) {
    for (let i = 0; i < limit; i++) {
      const score = scoreRowForType(candidateRows[i], t);
      if (score > highestScore) {
        highestScore = score;
        bestType = t;
      }
    }
  }

  return highestScore >= 2 ? bestType : 'unknown';
}

/**
 * Automatically detects the Meesho reconciliation file type based on CSV headers
 */
export function detectCsvFileType(headers: string[]): 'order' | 'payment' | 'ads' | 'unknown' {
  return detectCsvFileTypeFromRows([headers]);
}

