/**
 * Management Report Export Utilities
 * Exports the structured analytical intelligence report to CSV.
 */

import { ManagementReportResult } from './reports-engine';

export function exportManagementReportToCSV(report: ManagementReportResult, filename = 'Management-Intelligence-Report.csv') {
  if (!report) return;

  const lines: string[] = [];

  // 1. Header
  lines.push('REHANZA-HUB EXECUTIVE MANAGEMENT REPORT');
  lines.push(`Period:,"${report.period.label}"`);
  lines.push(`Exported At:,"${new Date().toISOString()}"`);
  lines.push('');

  // 2. Executive KPIs
  lines.push('1. EXECUTIVE SUMMARY & PARITY AUDIT');
  lines.push('Metric,Value');
  lines.push(`Total Sales Invoice,₹${report.summaryParity.totalSalesInvoice}`);
  lines.push(`Bank Settlement Amount,₹${report.summaryParity.settlementAmount}`);
  lines.push(`Final Realized Net Profit,₹${report.summaryParity.finalPayoutNetProfit}`);
  lines.push(`Total Dispatched Orders,${report.summaryParity.totalOrders}`);
  lines.push(`Net Retention Rate,${report.profitLeakage.netRetentionRate}%`);
  lines.push('');

  // 3. PoP Comparison
  lines.push('2. PERIOD-OVER-PERIOD (PoP) VARIANCE');
  lines.push('Metric,Current Period,Prior Period,Variance %');
  lines.push(`Gross Sales,₹${report.periodComparison.revenue.current},₹${report.periodComparison.revenue.prior},${report.periodComparison.revenue.deltaPercent ?? 'N/A'}%`);
  lines.push(`Net Profit,₹${report.periodComparison.netProfit.current},₹${report.periodComparison.netProfit.prior},${report.periodComparison.netProfit.deltaPercent ?? 'N/A'}%`);
  lines.push(`Dispatched Orders,${report.periodComparison.orders.current},${report.periodComparison.orders.prior},${report.periodComparison.orders.deltaPercent ?? 'N/A'}%`);
  lines.push(`Net Margin %,${report.periodComparison.margin.currentPercent}%,${report.periodComparison.margin.priorPercent}%,${report.periodComparison.margin.expansionBps} bps`);
  lines.push('');

  // 4. Cost Waterfall
  lines.push('3. COST STRUCTURE WATERFALL (GROSS TO NET)');
  lines.push('Step,Amount,Running Total,% of Gross Sales');
  report.costWaterfall.forEach((step) => {
    lines.push(`"${step.label}",₹${step.amount},₹${step.runningTotal},${step.percentOfGross}%`);
  });
  lines.push('');

  // 5. Margin Traps
  lines.push('4. MARGIN TRAPS (HIGH SALES, NEGATIVE PROFIT)');
  lines.push('SKU,Product Name,Revenue,Net Loss,Margin %,Return %,RTO %,Diagnosis');
  report.marginTraps.forEach((trap) => {
    lines.push(`"${trap.sku}","${trap.productName}",₹${trap.revenue},₹${trap.profit},${trap.profitMargin ?? 'N/A'}%,${trap.returnRate}%,${trap.rtoRate}%,"${trap.diagnosis}"`);
  });
  lines.push('');

  // 6. Return & RTO Bleeders
  lines.push('5. TOP RETURN & RTO LOGISTICS BLEEDERS');
  lines.push('SKU,Product Name,Total Orders,Customer Returns,Return %,RTO Orders,RTO %,Estimated Loss');
  report.returnRtoDamage.topReturnBleeders.forEach((b) => {
    lines.push(`"${b.sku}","${b.productName}",${b.totalOrders},${b.returnOrders},${b.returnRate}%,${b.rtoOrders},${b.rtoRate}%,₹${b.estimatedLoss}`);
  });
  lines.push('');

  // 7. Directives
  lines.push('6. EXECUTIVE ACTION DIRECTIVES');
  lines.push('Priority,Type,Directive Title,Action Text,Impact Estimate');
  report.managementAttentionBoard.directives.forEach((d) => {
    lines.push(`${d.priority},"${d.type}","${d.title}","${d.actionText}","${d.impactEstimate}"`);
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
