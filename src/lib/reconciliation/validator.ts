/**
 * CSV Validation for Meesho Reconciliation
 * Validates file format, headers, and data types
 */

import {
  findOrderColumns,
  findPaymentColumns,
  findAdsColumns,
  parseNumeric,
  parseDate
} from './csv-parser';

export interface ValidationError {
  rowNumber?: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  headerMapping: Record<string, number>;
}

/**
 * Validate CSV headers exist and can be mapped
 */
function validateHeadersExist(
  headers: string[],
  sourceType: 'order' | 'payment' | 'ads',
  columnMapping: Record<string, number>
): ValidationError[] {
  const errors: ValidationError[] = [];

  const requiredFields: Record<string, string[]> = {
    order: ['subOrderNo', 'sku', 'quantity', 'orderDate'],
    payment: ['subOrderNo', 'transactionId', 'finalSettlementAmount'],
    ads: ['campaignId', 'adCost', 'deductionDate']
  };

  const required = requiredFields[sourceType] || [];

  for (const field of required) {
    if (!(field in columnMapping)) {
      errors.push({
        message: `Required header not found: ${field}`,
        severity: 'error'
      });
    }
  }

  return errors;
}

/**
 * Validate Order CSV
 */
export function validateOrderCSV(
  csvData: {
    headers: string[];
    rows: Array<{ rowNumber: number; values: string[]; parsed: Record<string, any> }>;
  }
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const headerMapping = findOrderColumns(csvData.headers);

  // Check if critical headers exist
  const headerErrors = validateHeadersExist(csvData.headers, 'order', headerMapping);
  errors.push(...headerErrors);

  if (errors.length > 0) {
    return { isValid: false, errors, warnings, headerMapping };
  }

  // Validate each row
  for (const row of csvData.rows) {
    // Validate quantity is numeric
    if (headerMapping['quantity'] !== undefined) {
      const qty = row.values[headerMapping['quantity']];
      if (qty && parseNumeric(qty) === null) {
        errors.push({
          rowNumber: row.rowNumber,
          field: 'quantity',
          message: `Invalid quantity: "${qty}" is not a number`,
          severity: 'error'
        });
      }
    }

    // Validate date format
    if (headerMapping['orderDate'] !== undefined) {
      const date = row.values[headerMapping['orderDate']];
      if (date && parseDate(date) === null) {
        warnings.push({
          rowNumber: row.rowNumber,
          field: 'orderDate',
          message: `Invalid date format: "${date}"`,
          severity: 'warning'
        });
      }
    }

    // Sub order no should exist
    if (headerMapping['subOrderNo'] !== undefined) {
      const subOrderNo = row.values[headerMapping['subOrderNo']];
      if (!subOrderNo || subOrderNo.trim() === '') {
        errors.push({
          rowNumber: row.rowNumber,
          field: 'subOrderNo',
          message: 'Sub Order No is required',
          severity: 'error'
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    headerMapping
  };
}

/**
 * Validate Payment CSV
 */
export function validatePaymentCSV(
  csvData: {
    headers: string[];
    rows: Array<{ rowNumber: number; values: string[]; parsed: Record<string, any> }>;
  }
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const headerMapping = findPaymentColumns(csvData.headers);

  // Check if critical headers exist
  const headerErrors = validateHeadersExist(csvData.headers, 'payment', headerMapping);
  errors.push(...headerErrors);

  if (errors.length > 0) {
    return { isValid: false, errors, warnings, headerMapping };
  }

  // Validate each row
  for (const row of csvData.rows) {
    // Validate numeric fields
    const numericFields = [
      'finalSettlementAmount',
      'quantity',
      'commissionPercentage',
      'tcs',
      'tds',
      'tdsRate',
      'warehousingFee',
      'shippingCharge',
      'returnShippingCharge'
    ];

    for (const field of numericFields) {
      if (headerMapping[field] !== undefined) {
        const value = row.values[headerMapping[field]];
        if (value && value.trim() !== '' && parseNumeric(value) === null) {
          errors.push({
            rowNumber: row.rowNumber,
            field,
            message: `Invalid numeric value: "${value}" is not a number`,
            severity: 'error'
          });
        }
      }
    }

    // Validate dates
    const dateFields = ['orderDate', 'dispatchDate', 'paymentDate', 'deductionDate'];
    for (const field of dateFields) {
      if (headerMapping[field] !== undefined) {
        const value = row.values[headerMapping[field]];
        if (value && value.trim() !== '' && parseDate(value) === null) {
          warnings.push({
            rowNumber: row.rowNumber,
            field,
            message: `Invalid date format: "${value}"`,
            severity: 'warning'
          });
        }
      }
    }

    // Sub order no should exist
    if (headerMapping['subOrderNo'] !== undefined) {
      const subOrderNo = row.values[headerMapping['subOrderNo']];
      if (!subOrderNo || subOrderNo.trim() === '') {
        errors.push({
          rowNumber: row.rowNumber,
          field: 'subOrderNo',
          message: 'Sub Order No is required',
          severity: 'error'
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    headerMapping
  };
}

/**
 * Validate Ads CSV
 */
export function validateAdsCSV(
  csvData: {
    headers: string[];
    rows: Array<{ rowNumber: number; values: string[]; parsed: Record<string, any> }>;
  }
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const headerMapping = findAdsColumns(csvData.headers);

  // Check if critical headers exist
  const headerErrors = validateHeadersExist(csvData.headers, 'ads', headerMapping);
  errors.push(...headerErrors);

  if (errors.length > 0) {
    return { isValid: false, errors, warnings, headerMapping };
  }

  // Validate each row
  for (const row of csvData.rows) {
    // Validate numeric fields
    const numericFields = ['adCost', 'creditsWaivers', 'adCostInclCredits', 'gst', 'totalAdsCost'];

    for (const field of numericFields) {
      if (headerMapping[field] !== undefined) {
        const value = row.values[headerMapping[field]];
        if (value && value.trim() !== '' && parseNumeric(value) === null) {
          errors.push({
            rowNumber: row.rowNumber,
            field,
            message: `Invalid numeric value: "${value}" is not a number`,
            severity: 'error'
          });
        }
      }
    }

    // Validate date
    if (headerMapping['deductionDate'] !== undefined) {
      const date = row.values[headerMapping['deductionDate']];
      if (date && date.trim() !== '' && parseDate(date) === null) {
        warnings.push({
          rowNumber: row.rowNumber,
          field: 'deductionDate',
          message: `Invalid date format: "${date}"`,
          severity: 'warning'
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    headerMapping
  };
}
