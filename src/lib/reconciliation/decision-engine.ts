/**
 * Business Intelligence & Scaling Decision Engine (Phase 4)
 * 
 * Deterministic, explainable business recommendation engine that evaluates
 * unit economics, fulfillment metrics, and sample sufficiency to generate
 * operational decisions (SCALE, HEALTHY, MONITOR, REVIEW, STOP).
 */

import {
  SkuProfitabilityMetric,
  DecisionState,
  DecisionConfidence,
  SkuDecisionRecommendation,
  DecisionEngineSummary,
  DecisionEngineResult,
  ReconciliationDateFilter,
} from './types';

export type { DecisionEngineSummary, SkuDecisionRecommendation, DecisionEngineResult };
import { calculateSkuAnalytics } from './sku-analytics-calculator';
import { formatINRWithDecimals } from '@/lib/format';

// Configurable Constants (Section 5)
export const MIN_SAMPLE_ORDERS = 10;
export const HIGH_SAMPLE_ORDERS = 50;
export const HEALTHY_DELIVERED_RATE = 50;
export const CRITICAL_RETURN_RATE = 20;
export const CRITICAL_RTO_RATE = 25;
export const HEALTHY_MARGIN = 10;

/**
 * Calculate deterministic Risk Score (0 to 100)
 * Higher = greater financial leakage or operational risk.
 */
export function calculateRiskScore(sku: SkuProfitabilityMetric): number {
  let score = 0;

  // 1. Profit & Margin Risk (up to 45 pts)
  if (sku.profit < 0) {
    score += 25;
    if (sku.profitMargin !== null && sku.profitMargin < 0) {
      // Scale negative margin up to 20 additional points
      score += Math.min(20, Math.round(Math.abs(sku.profitMargin)));
    }
  } else if (sku.profitMargin !== null && sku.profitMargin < 3) {
    score += 15; // Critical thin margin vulnerability
  } else if (sku.profitMargin !== null && sku.profitMargin < 8) {
    score += 8; // Moderate thin margin vulnerability
  }

  // 2. Return Rate Risk (up to 25 pts)
  if (sku.returnRate > 10) {
    score += Math.min(25, Math.round(((sku.returnRate - 10) / 25) * 25));
  }

  // 3. RTO Rate Risk (up to 25 pts)
  if (sku.rtoRate > 15) {
    score += Math.min(25, Math.round(((sku.rtoRate - 15) / 25) * 25));
  }

  // 4. Low Delivered Rate Penalty (up to 10 pts)
  if (sku.totalOrders >= MIN_SAMPLE_ORDERS && sku.deliveredRate < 40) {
    score += 10;
  }

  // 5. Low Sample Uncertainty (5 pts)
  if (sku.totalOrders < MIN_SAMPLE_ORDERS) {
    score += 5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate deterministic Opportunity Score (0 to 100)
 * Higher = stronger candidate for profitable scaling.
 */
export function calculateOpportunityScore(sku: SkuProfitabilityMetric): number {
  // If losing money, opportunity is structurally capped at low value
  if (sku.profit <= 0) {
    return Math.min(20, sku.totalOrders >= MIN_SAMPLE_ORDERS ? 10 : 5);
  }

  let score = 0;

  // 1. Profitability & Margin (up to 45 pts)
  score += 20; // Baseline positive profit
  if (sku.profitMargin !== null) {
    if (sku.profitMargin >= 20) {
      score += 25;
    } else if (sku.profitMargin >= 10) {
      score += 15;
    } else if (sku.profitMargin >= 5) {
      score += 5;
    }
  }

  // 2. Fulfillment Health (up to 35 pts)
  if (sku.deliveredRate >= 60) {
    score += 15;
  } else if (sku.deliveredRate >= 50) {
    score += 10;
  }

  if (sku.returnRate < 10) {
    score += 10;
  } else if (sku.returnRate < 15) {
    score += 5;
  }

  if (sku.rtoRate < 15) {
    score += 10;
  } else if (sku.rtoRate < 20) {
    score += 5;
  }

  // 3. Volume Provenness (up to 20 pts)
  if (sku.totalOrders >= HIGH_SAMPLE_ORDERS) {
    score += 20;
  } else if (sku.totalOrders >= MIN_SAMPLE_ORDERS) {
    score += 10;
  } else {
    // Insufficient volume caps opportunity score to avoid false scaling
    score = Math.min(score, 45);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Generate explainable recommendation for a single SKU
 */
export function evaluateSkuDecision(sku: SkuProfitabilityMetric): SkuDecisionRecommendation {
  const riskScore = calculateRiskScore(sku);
  const opportunityScore = calculateOpportunityScore(sku);

  // Determine Confidence Level based on sample size
  let confidence: DecisionConfidence = 'LOW';
  if (sku.totalOrders >= HIGH_SAMPLE_ORDERS) {
    confidence = 'HIGH';
  } else if (sku.totalOrders >= MIN_SAMPLE_ORDERS) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  const reasons: string[] = [];
  let decision: DecisionState = 'MONITOR';
  let primaryReason = '';
  let action = '';

  // ----------------------------------------------------
  // CASE 1: Insufficient Sample Size (< MIN_SAMPLE_ORDERS)
  // Guard against making premature SCALE or STOP decisions
  // ----------------------------------------------------
  if (sku.totalOrders < MIN_SAMPLE_ORDERS) {
    decision = 'MONITOR';
    primaryReason = `Insufficient order volume for a conclusive scaling decision (${sku.totalOrders} units sold; minimum ${MIN_SAMPLE_ORDERS} required)`;
    action = 'Collect more order data before adjusting marketing or procurement strategy';
    reasons.push(`Total orders: ${sku.totalOrders} units`);
    if (sku.profit < 0) {
      reasons.push(`Currently negative profit (${formatINRWithDecimals(sku.profit)}) but sample is too small to declare structurally unviable`);
    } else if (sku.profit > 0) {
      reasons.push(`Early profit is positive (${formatINRWithDecimals(sku.profit)}) but requires further volume validation`);
    }
  }
  // ----------------------------------------------------
  // CASE 2: Sufficient Sample Size (>= MIN_SAMPLE_ORDERS)
  // ----------------------------------------------------
  else {
    // A. STOP: High volume with severe negative profit or extreme return/RTO burden
    const isSevereLoss = sku.profit < 0 && (
      (sku.profitMargin !== null && sku.profitMargin <= -15) ||
      sku.profit < -5000 ||
      (sku.returnRate >= 30 && sku.rtoRate >= 25)
    );

    if (isSevereLoss) {
      decision = 'STOP';
      primaryReason = `Severe negative profitability of ${formatINRWithDecimals(sku.profit)} across ${sku.totalOrders} orders`;
      action = 'Pause scaling and investigate SKU economics & supply chain immediately';
      if (sku.profitMargin !== null) reasons.push(`Profit margin is deeply negative at ${sku.profitMargin}%`);
      if (sku.returnRate >= CRITICAL_RETURN_RATE) reasons.push(`Customer return rate is excessively high at ${sku.returnRate}%`);
      if (sku.rtoRate >= CRITICAL_RTO_RATE) reasons.push(`RTO courier failure rate is high at ${sku.rtoRate}%`);
      reasons.push(`Net operational loss: ${formatINRWithDecimals(sku.profit)}`);
    }
    // B. REVIEW: Negative profit or critical fulfillment leakage
    else if (
      sku.profit < 0 ||
      sku.returnRate >= CRITICAL_RETURN_RATE ||
      sku.rtoRate >= CRITICAL_RTO_RATE ||
      sku.deliveredRate < 35 ||
      (sku.profitMargin !== null && sku.profitMargin < 3)
    ) {
      decision = 'REVIEW';
      action = 'Review pricing, listing accuracy, product quality, and logistics performance';

      if (sku.profit < 0) {
        primaryReason = `SKU is generating net negative profit (${formatINRWithDecimals(sku.profit)})`;
      } else if (sku.returnRate >= CRITICAL_RETURN_RATE) {
        primaryReason = `Elevated customer return rate of ${sku.returnRate}% exceeds safety threshold (${CRITICAL_RETURN_RATE}%)`;
      } else if (sku.rtoRate >= CRITICAL_RTO_RATE) {
        primaryReason = `Elevated RTO rate of ${sku.rtoRate}% exceeds threshold (${CRITICAL_RTO_RATE}%)`;
      } else if (sku.deliveredRate < 35) {
        primaryReason = `Low delivery fulfillment rate of ${sku.deliveredRate}%`;
      } else {
        primaryReason = `Very thin profit margin (${sku.profitMargin ?? 0}%) leaves little safety buffer`;
      }

      if (sku.profitMargin !== null) reasons.push(`Profit margin: ${sku.profitMargin}%`);
      reasons.push(`Delivered rate: ${sku.deliveredRate}%`);
      reasons.push(`Return rate: ${sku.returnRate}%, RTO rate: ${sku.rtoRate}%`);
    }
    // C. SCALE: Multi-signal confirmation (profit, margin, delivered, returns, RTO)
    else if (
      sku.profit > 0 &&
      sku.profitMargin !== null &&
      sku.profitMargin >= 12 &&
      sku.deliveredRate >= HEALTHY_DELIVERED_RATE &&
      sku.returnRate <= 15 &&
      sku.rtoRate <= 20
    ) {
      decision = 'SCALE';
      primaryReason = `Strong unit economics with ${sku.profitMargin}% margin and healthy ${sku.deliveredRate}% delivery rate`;
      action = 'Increase exposure and advertising budget gradually';
      reasons.push(`Net realized profit: ${formatINRWithDecimals(sku.profit)}`);
      reasons.push(`Profit margin: ${sku.profitMargin}%`);
      reasons.push(`Healthy delivery rate: ${sku.deliveredRate}%`);
      reasons.push(`Controlled return rate: ${sku.returnRate}%, RTO rate: ${sku.rtoRate}%`);
    }
    // D. HEALTHY: Positive profit, solid metrics, but not exceeding SCALE thresholds
    else if (sku.profit > 0 && sku.profitMargin !== null && sku.profitMargin > 0) {
      decision = 'HEALTHY';
      primaryReason = `Consistently profitable (${formatINRWithDecimals(sku.profit)}) with stable fulfillment metrics`;
      action = 'Continue current operational strategy';
      reasons.push(`Profit margin: ${sku.profitMargin}%`);
      reasons.push(`Total volume: ${sku.totalOrders} units`);
      reasons.push(`Delivery rate: ${sku.deliveredRate}%`);
    }
    // E. MONITOR: Borderline or balanced metrics
    else {
      decision = 'MONITOR';
      primaryReason = 'Metrics are within acceptable ranges but warrant ongoing observation';
      action = 'Monitor profitability and fulfillment metrics closely';
      if (sku.profitMargin !== null) reasons.push(`Profit margin: ${sku.profitMargin}%`);
      reasons.push(`Delivery rate: ${sku.deliveredRate}%`);
    }
  }

  return {
    sku: sku.sku,
    productName: sku.productName,
    decision,
    confidence,
    action,
    primaryReason,
    reasons,
    riskScore,
    opportunityScore,
    metrics: {
      totalOrders: sku.totalOrders,
      revenue: sku.revenue,
      profit: sku.profit,
      profitMargin: sku.profitMargin,
      deliveredRate: sku.deliveredRate,
      returnRate: sku.returnRate,
      rtoRate: sku.rtoRate,
      aov: sku.aov,
    },
  };
}

/**
 * Run decision engine across all aggregated SKUs
 */
export async function generateDecisionEngineRecommendations(
  accountId: string,
  filter?: ReconciliationDateFilter
): Promise<DecisionEngineResult> {
  // 1. Fetch Phase 3 aggregated SKU analytics
  const analytics = await calculateSkuAnalytics(accountId, filter);
  const skus = analytics.skus;

  // 2. Evaluate decisions for each SKU
  const decisions: SkuDecisionRecommendation[] = skus.map(evaluateSkuDecision);

  // 3. Calculate Summary Counts and Highlights
  let scaleCount = 0;
  let healthyCount = 0;
  let monitorCount = 0;
  let reviewCount = 0;
  let stopCount = 0;
  let highRiskCount = 0;
  let highOpportunityCount = 0;

  for (const d of decisions) {
    if (d.decision === 'SCALE') scaleCount++;
    else if (d.decision === 'HEALTHY') healthyCount++;
    else if (d.decision === 'MONITOR') monitorCount++;
    else if (d.decision === 'REVIEW') reviewCount++;
    else if (d.decision === 'STOP') stopCount++;

    if (d.riskScore >= 70) highRiskCount++;
    if (d.opportunityScore >= 70) highOpportunityCount++;
  }

  // Key Highlights
  let bestOpportunity: SkuDecisionRecommendation | null = null;
  let highestRiskSku: SkuDecisionRecommendation | null = null;
  let mostProfitableSku: SkuDecisionRecommendation | null = null;
  let largestLossSku: SkuDecisionRecommendation | null = null;

  if (decisions.length > 0) {
    // Best Opportunity: highest opportunity score among positive-profit SKUs
    const oppSorted = [...decisions].sort((a, b) => b.opportunityScore - a.opportunityScore);
    bestOpportunity = oppSorted[0] || null;

    // Highest Risk: highest risk score
    const riskSorted = [...decisions].sort((a, b) => b.riskScore - a.riskScore);
    highestRiskSku = riskSorted[0] || null;

    // Most Profitable: highest net profit
    const profitSorted = [...decisions].sort((a, b) => b.metrics.profit - a.metrics.profit);
    mostProfitableSku = profitSorted[0] || null;

    // Largest Loss: lowest net profit (if negative)
    const lossCandidate = profitSorted[profitSorted.length - 1];
    if (lossCandidate && lossCandidate.metrics.profit < 0) {
      largestLossSku = lossCandidate;
    }
  }

  const summary: DecisionEngineSummary = {
    totalSkus: decisions.length,
    scaleCount,
    healthyCount,
    monitorCount,
    reviewCount,
    stopCount,
    highRiskCount,
    highOpportunityCount,
    bestOpportunity,
    highestRiskSku,
    mostProfitableSku,
    largestLossSku,
  };

  // 4. Prioritized Action List (Section 18)
  // Prioritize critical actions: STOP first, then REVIEW, then SCALE, then MONITOR/HEALTHY
  // Weighted by business impact: riskScore * orders for losses; opportunityScore * orders for scale
  const priorityActions = [...decisions].sort((a, b) => {
    const rankWeight: Record<DecisionState, number> = {
      STOP: 5,
      REVIEW: 4,
      SCALE: 3,
      MONITOR: 2,
      HEALTHY: 1,
    };

    const weightDiff = rankWeight[b.decision] - rankWeight[a.decision];
    if (weightDiff !== 0) return weightDiff;

    // Within same decision state, sort by financial impact
    if (b.decision === 'STOP' || b.decision === 'REVIEW') {
      return a.metrics.profit - b.metrics.profit; // most negative loss first
    }
    if (b.decision === 'SCALE') {
      return b.opportunityScore - a.opportunityScore;
    }
    return b.metrics.totalOrders - a.metrics.totalOrders;
  }).slice(0, 6);

  return {
    period: analytics.period,
    summary,
    decisions,
    priorityActions,
  };
}
