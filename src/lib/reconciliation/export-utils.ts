/**
 * Client-side CSV export utilities for Meesho Reconciliation
 * Strictly uses the authoritative data returned by the server APIs.
 */

function downloadCSV(csvContent: string, fileName: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export Financial Summary to CSV
 */
export function exportFinancialSummaryToCSV(summary: any, periodLabel: string = 'All Time') {
  if (!summary) return;

  const rows: string[][] = [
    ['REHANZA-HUB RECONCILIATION FINANCIAL OVERVIEW'],
    ['Period', periodLabel],
    ['Export Date', new Date().toISOString()],
    [],
    ['METRIC', 'VALUE', 'NOTE'],
    ['Total Sales (Invoice)', summary.totalSalesInvoice ?? 0, 'Final!A8'],
    ['Settlement Amount', summary.settlementAmount ?? 0, 'Final!B8'],
    ['Total Orders (SUM qty)', summary.orders?.totalOrders ?? 0, 'Final!D8'],
    ['Delivered Orders', summary.orders?.deliveredOrders ?? 0, 'Final!E8'],
    ['Delivered Rate (%)', summary.orders?.deliveredRate ?? 0, 'Final!E9'],
    ['Shipped Orders', summary.orders?.shippedOrders ?? 0, 'Final!D11'],
    ['Shipped Rate (%)', summary.orders?.shippedRate ?? 0, 'Final!D12'],
    ['Exchange Orders', summary.orders?.exchangeOrders ?? 0, 'Final!E11'],
    ['Exchange Rate (%)', summary.orders?.exchangeRate ?? 0, 'Final!E12'],
    ['Return Orders', summary.orders?.returnOrders ?? 0, 'Final!D14'],
    ['Return Rate (%)', summary.orders?.returnRate ?? 0, 'Final!D15'],
    ['RTO Orders', summary.orders?.rtoOrders ?? 0, 'Final!E14'],
    ['RTO Rate (%)', summary.orders?.rtoRate ?? 0, 'Final!E15'],
    ['Cancelled Orders', summary.orders?.cancelOrders ?? 0, 'Final!D17'],
    ['Cancelled Rate (%)', summary.orders?.cancelRate ?? 0, 'Final!D18'],
    ['Net Orders (Delivered+Exchange+Return)', summary.orders?.netOrders ?? 0, 'Final!D20'],
    ['Average Order Value (AOV)', summary.averageOrderValue ?? 0, 'Final!E20'],
    [],
    ['COST & DEDUCTION BREAKDOWN', 'AMOUNT (INR)', 'EXCEL CELL'],
    ['Purchase Cost', summary.costs?.purchaseCost ?? 0, 'Final!A11'],
    ['Packaging Cost', summary.costs?.packagingCost ?? 0, 'Final!B11'],
    ['Shipping Cost', summary.costs?.shippingCost ?? 0, 'Final!A14'],
    ['Return Shipping Cost', summary.costs?.returnShippingCost ?? 0, 'Final!B14'],
    ['TCS Deductions', summary.costs?.tcs ?? 0, 'Final!A17'],
    ['TDS Deductions', summary.costs?.tds ?? 0, 'Final!B17'],
    ['Claims & Compensations', summary.costs?.claims ?? 0, 'Final!G9'],
    ['Recovery Fees', summary.costs?.recoveryFees ?? 0, 'Final!H6'],
    ['RM Ads Spend', summary.costs?.adsCost ?? 0, 'Final!G6'],
    ['Fixed Platform Fees', summary.costs?.fixedFee ?? 0, 'Final!H9'],
    ['Warehousing Fees', summary.costs?.warehousingFee ?? 0, 'Final!H12'],
    ['Commission Fees', summary.costs?.commission ?? 0, 'Final!H15'],
    ['Input Tax Credit (GST)', summary.gstInputAmount ?? 0, 'Final!A21'],
    [],
    ['FINAL EXECUTIVE TOTALS', 'AMOUNT (INR)', 'EXCEL CELL'],
    ['Net Cashflow (A24)', summary.a24NetCashflow ?? 0, 'Final!A24'],
    ['Final Payout / Net Profit', summary.finalPayoutNetProfit ?? 0, 'Final!B23 / Final!B3']
  ];

  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  downloadCSV(csv, `reconciliation-financial-summary-${periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`);
}

/**
 * Export SKU Analytics to CSV
 */
export function exportSkuAnalyticsToCSV(skus: any[], periodLabel: string = 'All Time') {
  if (!skus || skus.length === 0) return;

  const headers = [
    'SKU',
    'Product Name',
    'Total Orders (Qty)',
    'Delivered Orders',
    'Return Orders',
    'RTO Orders',
    'Delivered Rate (%)',
    'Return Rate (%)',
    'RTO Rate (%)',
    'Net Orders',
    'Revenue (INR)',
    'Settlement (INR)',
    'Purchase Cost (INR)',
    'Packaging Cost (INR)',
    'Logistics Cost (INR)',
    'Net Profit (INR)',
    'Profit Margin (%)',
    'AOV (INR)'
  ];

  const rows = skus.map(s => [
    s.sku || '',
    s.productName || '',
    s.totalOrders ?? 0,
    s.deliveredOrders ?? 0,
    s.returnOrders ?? 0,
    s.rtoOrders ?? 0,
    s.deliveredRate != null ? Number(s.deliveredRate).toFixed(2) : '0.00',
    s.returnRate != null ? Number(s.returnRate).toFixed(2) : '0.00',
    s.rtoRate != null ? Number(s.rtoRate).toFixed(2) : '0.00',
    s.netOrders ?? 0,
    s.revenue ?? 0,
    s.settlement ?? 0,
    s.purchaseCost ?? 0,
    s.packagingCost ?? 0,
    s.logisticsCost ?? 0,
    s.profit ?? 0,
    s.profitMargin != null ? Number(s.profitMargin).toFixed(2) : 'N/A',
    s.averageOrderValue != null ? Number(s.averageOrderValue).toFixed(2) : '0.00'
  ]);

  const csv = [
    headers.map(escapeCSV).join(','),
    ...rows.map(r => r.map(escapeCSV).join(','))
  ].join('\n');

  downloadCSV(csv, `reconciliation-sku-analytics-${periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`);
}

/**
 * Export Daily Financial Analytics to CSV
 */
export function exportDailyAnalyticsToCSV(dailyTrends: any[], periodLabel: string = 'All Time') {
  if (!dailyTrends || dailyTrends.length === 0) return;

  const headers = [
    'Date',
    'Orders (Qty)',
    'Gross Revenue (INR)',
    'Settlement Amount (INR)',
    'Net Profit / Loss (INR)',
    'Delivered Orders',
    'Return Orders',
    'RTO Orders'
  ];

  const rows = dailyTrends.map(d => [
    d.date || '',
    d.orders ?? 0,
    d.revenue ?? 0,
    d.settlement ?? 0,
    d.profit ?? 0,
    d.deliveredOrders ?? 0,
    d.returnOrders ?? 0,
    d.rtoOrders ?? 0
  ]);

  const csv = [
    headers.map(escapeCSV).join(','),
    ...rows.map(r => r.map(escapeCSV).join(','))
  ].join('\n');

  downloadCSV(csv, `reconciliation-daily-performance-${periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`);
}

/**
 * Export Decision Engine Recommendations to CSV
 */
export function exportDecisionEngineToCSV(recommendations: any[], periodLabel: string = 'All Time') {
  if (!recommendations || recommendations.length === 0) return;

  const headers = [
    'Decision',
    'SKU',
    'Product Name',
    'Net Profit (INR)',
    'Profit Margin (%)',
    'Total Orders',
    'Return Rate (%)',
    'RTO Rate (%)',
    'Risk Score',
    'Opportunity Score',
    'Confidence',
    'Primary Reason',
    'Recommended Action'
  ];

  const rows = recommendations.map(r => [
    r.decision || '',
    r.sku || '',
    r.productName || '',
    r.metrics?.profit ?? 0,
    r.metrics?.margin != null ? Number(r.metrics.margin).toFixed(2) : 'N/A',
    r.metrics?.totalOrders ?? 0,
    r.metrics?.returnRate != null ? Number(r.metrics.returnRate).toFixed(2) : '0.00',
    r.metrics?.rtoRate != null ? Number(r.metrics.rtoRate).toFixed(2) : '0.00',
    r.riskScore ?? 0,
    r.opportunityScore ?? 0,
    r.confidence || '',
    r.primaryReason || '',
    r.recommendedAction || ''
  ]);

  const csv = [
    headers.map(escapeCSV).join(','),
    ...rows.map(r => r.map(escapeCSV).join(','))
  ].join('\n');

  downloadCSV(csv, `reconciliation-decision-engine-${periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`);
}
