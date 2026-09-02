/**
 * Phase 4: Business Intelligence & Decision Engine Validation Script
 * 
 * Validates deterministic business rules, confidence levels, risk scoring,
 * opportunity scoring, priority rankings, and boundary conditions.
 */

import {
  evaluateSkuDecision,
  calculateRiskScore,
  calculateOpportunityScore,
  MIN_SAMPLE_ORDERS,
  HIGH_SAMPLE_ORDERS,
} from './decision-engine';
import { SkuProfitabilityMetric } from './types';

export function runDecisionEngineTests() {
  console.log('====================================================');
  console.log('PHASE 4: RUNNING DECISION ENGINE VALIDATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName} (Expected: ${expected}, Actual: ${actual})`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Positive Profitable Multi-Signal SKU -> SCALE
  // ----------------------------------------------------
  console.log('--- TEST 1: Strong Economics SKU -> SCALE ---');
  const scaleSku: SkuProfitabilityMetric = {
    sku: 'SKU-SCALE-WINNER',
    productName: 'High Performing Item',
    totalOrders: 65,
    deliveredOrders: 45, // 69.2% delivered
    shippedOrders: 2,
    exchangeOrders: 3,
    returnOrders: 5, // 7.7% return
    rtoOrders: 6, // 9.2% RTO
    cancelOrders: 4,
    netOrders: 53,
    revenue: 130000,
    settlementAmount: 75000,
    purchaseCost: -35000,
    packagingCost: -4000,
    shippingCost: -5000,
    returnShippingCost: -1500,
    adsCost: null,
    recoveryFees: 0,
    claims: 0,
    tcs: -130,
    tds: -26,
    fixedFee: 0,
    commission: 0,
    warehousingFee: 0,
    profit: 29344,
    profitMargin: 22.57, // > 12%
    aov: 2000,
    returnRate: 7.69, // < 15%
    rtoRate: 9.23, // < 20%
    deliveredRate: 69.23, // >= 50%
  };

  const scaleDec = evaluateSkuDecision(scaleSku);
  assert(scaleDec.decision === 'SCALE', 'Qualifies for SCALE decision', scaleDec.decision, 'SCALE');
  assert(scaleDec.confidence === 'HIGH', 'Confidence is HIGH for 65 orders (>= 50)', scaleDec.confidence, 'HIGH');
  assert(scaleDec.opportunityScore >= 70, 'Opportunity score is high (>= 70)', scaleDec.opportunityScore, '>= 70');
  assert(scaleDec.riskScore < 30, 'Risk score is low (< 30)', scaleDec.riskScore, '< 30');

  // ----------------------------------------------------
  // TEST 2: Negative-Profit High-Volume SKU -> STOP
  // ----------------------------------------------------
  console.log('--- TEST 2: Severe Loss-Making SKU -> STOP ---');
  const stopSku: SkuProfitabilityMetric = {
    sku: 'SKU-SEVERE-BLEED',
    productName: 'Heavy Loss Maker',
    totalOrders: 120,
    deliveredOrders: 40,
    shippedOrders: 5,
    exchangeOrders: 5,
    returnOrders: 35, // 29.2% return
    rtoOrders: 35, // 29.2% RTO
    cancelOrders: 5,
    netOrders: 80,
    revenue: 96000,
    settlementAmount: 22000,
    purchaseCost: -48000,
    packagingCost: -6000,
    shippingCost: -8000,
    returnShippingCost: -6000,
    adsCost: null,
    recoveryFees: -2500,
    claims: 0,
    tcs: -96,
    tds: -19,
    fixedFee: 0,
    commission: 0,
    warehousingFee: 0,
    profit: -28615,
    profitMargin: -29.81, // deeply negative <= -15%
    aov: 800,
    returnRate: 29.17,
    rtoRate: 29.17,
    deliveredRate: 33.33,
  };

  const stopDec = evaluateSkuDecision(stopSku);
  assert(stopDec.decision === 'STOP', 'Identifies severe loss-maker as STOP', stopDec.decision, 'STOP');
  assert(stopDec.confidence === 'HIGH', 'Confidence is HIGH for 120 orders', stopDec.confidence, 'HIGH');
  assert(stopDec.riskScore >= 70, 'Risk score is very high (>= 70)', stopDec.riskScore, '>= 70');
  assert(stopDec.opportunityScore <= 20, 'Opportunity score is capped low (<= 20)', stopDec.opportunityScore, '<= 20');

  // ----------------------------------------------------
  // TEST 3: High-Return SKU -> REVIEW
  // ----------------------------------------------------
  console.log('--- TEST 3: High Return SKU -> REVIEW ---');
  const returnSku: SkuProfitabilityMetric = {
    sku: 'SKU-HIGH-RETURNS',
    productName: 'Sizing Issue Apparel',
    totalOrders: 40,
    deliveredOrders: 16,
    shippedOrders: 2,
    exchangeOrders: 2,
    returnOrders: 12, // 30% return (critical >= 20%)
    rtoOrders: 6,
    cancelOrders: 4,
    netOrders: 30,
    revenue: 40000,
    settlementAmount: 18000,
    purchaseCost: -14000,
    packagingCost: -1600,
    shippingCost: -2500,
    returnShippingCost: -2200,
    adsCost: null,
    recoveryFees: 0,
    claims: 0,
    tcs: -40,
    tds: -8,
    fixedFee: 0,
    commission: 0,
    warehousingFee: 0,
    profit: 200, // Marginally positive
    profitMargin: 0.5,
    aov: 1000,
    returnRate: 30.0,
    rtoRate: 15.0,
    deliveredRate: 40.0,
  };

  const returnDec = evaluateSkuDecision(returnSku);
  assert(returnDec.decision === 'REVIEW', 'High return rate triggers REVIEW', returnDec.decision, 'REVIEW');
  assert(returnDec.confidence === 'MEDIUM', 'Confidence is MEDIUM for 40 orders (10-49)', returnDec.confidence, 'MEDIUM');
  assert(returnDec.primaryReason.includes('return rate') || returnDec.primaryReason.includes('margin'), 'Primary reason cites return rate or margin', returnDec.primaryReason);

  // ----------------------------------------------------
  // TEST 4: High-RTO SKU -> REVIEW
  // ----------------------------------------------------
  console.log('--- TEST 4: High RTO SKU -> REVIEW ---');
  const rtoSku: SkuProfitabilityMetric = {
    sku: 'SKU-HIGH-RTO',
    productName: 'Courier Failure Item',
    totalOrders: 35,
    deliveredOrders: 14,
    shippedOrders: 1,
    exchangeOrders: 0,
    returnOrders: 3,
    rtoOrders: 14, // 40% RTO rate
    cancelOrders: 4,
    netOrders: 17,
    revenue: 35000,
    settlementAmount: 12000,
    purchaseCost: -10500,
    packagingCost: -1400,
    shippingCost: -2100,
    returnShippingCost: -1800,
    adsCost: null,
    recoveryFees: 0,
    claims: 0,
    tcs: -35,
    tds: -7,
    fixedFee: 0,
    commission: 0,
    warehousingFee: 0,
    profit: 50,
    profitMargin: 0.14,
    aov: 1000,
    returnRate: 8.57,
    rtoRate: 40.0,
    deliveredRate: 40.0,
  };

  const rtoDec = evaluateSkuDecision(rtoSku);
  assert(rtoDec.decision === 'REVIEW', 'High RTO rate triggers REVIEW', rtoDec.decision, 'REVIEW');
  assert(rtoDec.riskScore >= 40, 'Risk score is elevated for high RTO', rtoDec.riskScore, '>= 40');

  // ----------------------------------------------------
  // TEST 5: Low-Volume Sample (< 10) -> LOW Confidence MONITOR
  // ----------------------------------------------------
  console.log('--- TEST 5: Low Volume Sample -> LOW Confidence MONITOR ---');
  const lowVolSku: SkuProfitabilityMetric = {
    sku: 'SKU-LOW-SAMPLE',
    productName: 'New Launch Test SKU',
    totalOrders: 3, // < 10
    deliveredOrders: 2,
    shippedOrders: 0,
    exchangeOrders: 0,
    returnOrders: 0,
    rtoOrders: 1,
    cancelOrders: 0,
    netOrders: 2,
    revenue: 3000,
    settlementAmount: 1600,
    purchaseCost: -900,
    packagingCost: -120,
    shippingCost: -180,
    returnShippingCost: 0,
    adsCost: null,
    recoveryFees: 0,
    claims: 0,
    tcs: -3,
    tds: -1,
    fixedFee: 0,
    commission: 0,
    warehousingFee: 0,
    profit: 400,
    profitMargin: 13.33,
    aov: 1000,
    returnRate: 0,
    rtoRate: 33.33,
    deliveredRate: 66.67,
  };

  const lowVolDec = evaluateSkuDecision(lowVolSku);
  assert(lowVolDec.decision === 'MONITOR', 'Low sample size safely returns MONITOR (not premature SCALE)', lowVolDec.decision, 'MONITOR');
  assert(lowVolDec.confidence === 'LOW', 'Confidence is strictly LOW for < 10 orders', lowVolDec.confidence, 'LOW');
  assert(lowVolDec.primaryReason.includes('Insufficient order volume'), 'Primary reason explains small sample', lowVolDec.primaryReason);

  // ----------------------------------------------------
  // TEST 6: Zero Revenue Safe Handling
  // ----------------------------------------------------
  console.log('--- TEST 6: Zero Revenue Safety ---');
  const zeroRevSku: SkuProfitabilityMetric = {
    sku: 'SKU-ZERO-REV',
    productName: 'Unsold Catalog Listing',
    totalOrders: 0,
    deliveredOrders: 0,
    shippedOrders: 0,
    exchangeOrders: 0,
    returnOrders: 0,
    rtoOrders: 0,
    cancelOrders: 0,
    netOrders: 0,
    revenue: 0,
    settlementAmount: 0,
    purchaseCost: 0,
    packagingCost: 0,
    shippingCost: 0,
    returnShippingCost: 0,
    adsCost: null,
    recoveryFees: 0,
    claims: 0,
    tcs: 0,
    tds: 0,
    fixedFee: 0,
    commission: 0,
    warehousingFee: 0,
    profit: 0,
    profitMargin: null,
    aov: null,
    returnRate: 0,
    rtoRate: 0,
    deliveredRate: 0,
  };

  const zeroRevDec = evaluateSkuDecision(zeroRevSku);
  assert(zeroRevDec.decision === 'MONITOR', 'Zero orders returns MONITOR', zeroRevDec.decision, 'MONITOR');
  assert(zeroRevDec.confidence === 'LOW', 'Confidence is LOW', zeroRevDec.confidence, 'LOW');
  assert(!isNaN(zeroRevDec.riskScore), 'Risk score is numeric, not NaN', zeroRevDec.riskScore);
  assert(!isNaN(zeroRevDec.opportunityScore), 'Opportunity score is numeric, not NaN', zeroRevDec.opportunityScore);

  // ----------------------------------------------------
  // TEST 7: Negative Margin Sign Preservation
  // ----------------------------------------------------
  console.log('--- TEST 7: Negative Margin Sign Preservation ---');
  assert(stopSku.profitMargin === -29.81, 'Negative profit margin is preserved (-29.81%)', stopSku.profitMargin, -29.81);
  assert(stopDec.metrics.profitMargin === -29.81, 'Recommendation metric keeps negative margin', stopDec.metrics.profitMargin, -29.81);

  // ----------------------------------------------------
  // TEST 8: Healthy Classification
  // ----------------------------------------------------
  console.log('--- TEST 8: Healthy Classification ---');
  const healthySku: SkuProfitabilityMetric = {
    sku: 'SKU-HEALTHY-PROD',
    productName: 'Stable Performer',
    totalOrders: 25,
    deliveredOrders: 13, // 52%
    shippedOrders: 2,
    exchangeOrders: 1,
    returnOrders: 3, // 12%
    rtoOrders: 4, // 16%
    cancelOrders: 2,
    netOrders: 17,
    revenue: 25000,
    settlementAmount: 14000,
    purchaseCost: -8000,
    packagingCost: -1000,
    shippingCost: -1500,
    returnShippingCost: -600,
    adsCost: null,
    recoveryFees: 0,
    claims: 0,
    tcs: -25,
    tds: -5,
    fixedFee: 0,
    commission: 0,
    warehousingFee: 0,
    profit: 2870,
    profitMargin: 11.48, // > 0, but < 12% (so healthy, not scale)
    aov: 1000,
    returnRate: 12.0,
    rtoRate: 16.0,
    deliveredRate: 52.0,
  };

  const healthyDec = evaluateSkuDecision(healthySku);
  assert(healthyDec.decision === 'HEALTHY', 'Qualifies for HEALTHY decision', healthyDec.decision, 'HEALTHY');
  assert(healthyDec.confidence === 'MEDIUM', 'Confidence is MEDIUM (25 orders)', healthyDec.confidence, 'MEDIUM');

  console.log('\n====================================================');
  console.log(`VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    throw new Error(`Phase 4 validation failed with ${failed} failed assertions.`);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runDecisionEngineTests();
}

