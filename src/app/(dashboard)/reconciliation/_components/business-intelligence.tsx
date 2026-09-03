'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { DecisionSummary } from './decision-summary';
import { PriorityActions } from './priority-actions';
import { ProfitabilityMatrix } from './profitability-matrix';
import { FulfillmentRiskMatrix } from './fulfillment-risk-matrix';
import { DecisionTable } from './decision-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Sparkles, Inbox, UploadCloud, Download } from 'lucide-react';
import { exportDecisionEngineToCSV } from '@/lib/reconciliation/export-utils';
import {
  ReconciliationDateFilter,
  DecisionState,
  DecisionEngineSummary,
  SkuDecisionRecommendation,
} from '@/lib/reconciliation/types';

interface BusinessIntelligenceProps {
  accountId: string;
  filter: ReconciliationDateFilter;
  refreshTrigger?: number;
}

export function BusinessIntelligence({
  accountId,
  filter,
  refreshTrigger,
}: BusinessIntelligenceProps) {
  const [summary, setSummary] = useState<DecisionEngineSummary | null>(null);
  const [decisions, setDecisions] = useState<SkuDecisionRecommendation[]>([]);
  const [priorityActions, setPriorityActions] = useState<SkuDecisionRecommendation[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<DecisionState | 'ALL'>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecisions = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filter.range) params.set('range', filter.range);
      if (filter.month) params.set('month', filter.month);
      if (filter.year) params.set('year', filter.year.toString());
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);

      const res = await apiFetch(`/api/reconciliation/decision-engine?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to fetch decision engine recommendations');
      }

      const data = await res.json();
      setSummary(data.summary || null);
      setDecisions(data.decisions || []);
      setPriorityActions(data.priorityActions || []);
    } catch (err: any) {
      console.error('Decision engine fetch error:', err);
      setError(err.message || 'Failed to communicate with Business Intelligence service.');
    } finally {
      setLoading(false);
    }
  }, [accountId, filter]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions, refreshTrigger]);

  return (
    <div className="space-y-6 pt-2">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-headline tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-400" />
            <span>Business Intelligence & Scaling Decisions</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
            Actionable recommendations from your reconciliation data
          </p>
        </div>

        {decisions.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportDecisionEngineToCSV(decisions, filter.range || 'Custom')}
            className="glass-button bg-indigo-950/40 border-indigo-400/30 hover:bg-indigo-900/50 text-indigo-200 h-8 px-3 rounded-xl font-bold text-xs"
            title="Export Decision Engine Recommendations as CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
            <span>Export Decisions CSV</span>
          </Button>
        )}
      </div>

      {/* Error State */}
      {error && !loading && (
        <Card className="glass-panel bg-rose-950/30 border-rose-500/40 rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Error Loading Scaling Intelligence</h4>
                <p className="text-xs text-rose-300 mt-0.5">{error}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchDecisions}
              className="glass-button bg-rose-900/40 border-rose-400/30 text-white text-xs font-bold rounded-xl"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State Banner (if no SKUs exist) */}
      {!loading && !error && decisions.length === 0 && (
        <Card className="glass-panel bg-slate-950/60 border-white/15 rounded-2xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <CardContent className="p-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-left">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                <Inbox className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">No Decision Recommendations for this Period</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Upload Orders, Payments and RM Ads to generate AI-free explainable decision intelligence.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-indigo-300 font-bold bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-400/20">
              <UploadCloud className="h-4 w-4" />
              <span>Use Data Ingestion Section Below</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 1. Decision Summary Cards & Key Highlights */}
      <DecisionSummary
        summary={summary}
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
        loading={loading}
      />

      {/* 2. Priority Operational Actions */}
      <PriorityActions priorityActions={priorityActions} loading={loading} />

      {/* 3. Visual Matrixes (Profitability & Fulfillment Risk) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProfitabilityMatrix decisions={decisions} loading={loading} />
        <FulfillmentRiskMatrix decisions={decisions} loading={loading} />
      </div>

      {/* 4. Master Decision Table */}
      <DecisionTable
        decisions={decisions}
        selectedDecisionFilter={selectedFilter}
        onSelectDecisionFilter={setSelectedFilter}
        loading={loading}
      />
    </div>
  );
}

