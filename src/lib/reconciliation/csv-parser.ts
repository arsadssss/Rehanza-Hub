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
 * Removes extra whitespace, handles variations
 */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Parse CSV text into structured data
 * Returns both raw rows and parsed rows with header mapping
 */
export function parseCSV(csvText: string): {
  headers: string[];
  rows: Array<{ rowNumber: number; values: string[]; parsed: Record<string, any> }>;
  rawLines: string[];
} {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const normalizedHeaders = headers.map(normalizeHeader);
  
  const rows = [];
  const rawLines = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const parsed: Record<string, any> = {};

    // Map values to headers
    headers.forEach((header, idx) => {
      parsed[header] = values[idx] || '';
    });

    rows.push({
      rowNumber: i + 1, // 1-indexed (row 1 is headers, row 2 is first data)
      values,
      parsed
    });

    rawLines.push(lines[i]);
  }

  return { headers, rows, rawLines };
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
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.some(alias => normalized[i].includes(alias))) {
        mapping[key] = i;
        break;
      }
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
    'productGstPercent': ['product gst %', 'gst %'],
    'listingPrice': ['listing price'],
    'quantity': ['quantity'],
    'transactionId': ['transaction id', 'transaction'],
    'paymentDate': ['payment date'],
    'finalSettlementAmount': ['final settlement amount'],
    'priceType': ['price type'],
    'totalSaleAmount': ['total sale amount'],
    'totalSaleReturnAmount': ['total sale return amount'],
    'fixedFee': ['fixed fee'],
    'warehousingFee': ['warehousing fee'],
    'returnPremium': ['return premium'],
    'returnPremiumOfReturn': ['return premium of return'],
    'commissionPercentage': ['meesho commission percentage', 'commission percentage'],
    'commission': ['meesho commission', 'commission'],
    'goldPlatformFee': ['meesho gold platform fee', 'gold platform fee'],
    'mallPlatformFee': ['meesho mall platform fee', 'mall platform fee'],
    'returnShippingCharge': ['return shipping charge'],
    'gstCompensation': ['gst compensation'],
    'shippingCharge': ['shipping charge'],
    'otherSupportServiceCharges': ['other support service charges'],
    'waivers': ['waivers'],
    'netOtherSupportServiceCharges': ['net other support service charges'],
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

  for (const [key, aliases] of Object.entries(columnMappings)) {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.some(alias => normalized[i].includes(alias))) {
        mapping[key] = i;
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

  for (const [key, aliases] of Object.entries(columnMappings)) {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.some(alias => normalized[i].includes(alias))) {
        mapping[key] = i;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Parse numeric value safely
 */
export function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse date value safely
 */
export function parseDate(value: any): Date | null {
  if (!value) return null;
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
