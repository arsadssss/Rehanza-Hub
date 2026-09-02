'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, RotateCcw, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReconciliationDateFilter } from '@/lib/reconciliation/types';

interface PeriodFilterProps {
  currentFilter: ReconciliationDateFilter;
  periodLabel?: string;
  onFilterChange: (filter: ReconciliationDateFilter) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function PeriodFilter({
  currentFilter,
  periodLabel,
  onFilterChange,
  onRefresh,
  loading,
}: PeriodFilterProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'this_month' | 'prev_month' | 'custom'>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [showCustomInputs, setShowCustomInputs] = useState<boolean>(false);

  // Helper to get previous month string 'YYYY-MM'
  const getPrevMonthStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const handleSelectPreset = (preset: 'all' | 'this_month' | 'prev_month') => {
    setActiveTab(preset);
    setShowCustomInputs(false);
    setCustomError(null);

    if (preset === 'all') {
      onFilterChange({ range: 'all' });
    } else if (preset === 'this_month') {
      onFilterChange({ range: 'month' });
    } else if (preset === 'prev_month') {
      onFilterChange({ month: getPrevMonthStr() });
    }
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) {
      setCustomError('Both From and To dates are required.');
      return;
    }
    if (new Date(customStart) > new Date(customEnd)) {
      setCustomError('From date cannot be later than To date.');
      return;
    }
    setCustomError(null);
    setActiveTab('custom');
    onFilterChange({
      range: 'custom',
      startDate: customStart,
      endDate: customEnd,
    });
  };

  return (
    <div className="glass-panel bg-slate-950/60 border border-white/15 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] p-5 md:p-6 rounded-2xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-black font-headline tracking-tight text-white">
              Financial Overview
            </h2>
            {periodLabel && (
              <Badge
                variant="outline"
                className="glass-pill border-indigo-400/40 bg-indigo-500/15 text-indigo-300 font-bold text-xs px-3 py-1 rounded-lg"
              >
                {periodLabel}
              </Badge>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-300 mt-1 font-medium">
            Meesho Reconciliation & Profitability Command Center
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Buttons */}
          <div className="inline-flex rounded-xl p-1 bg-slate-950/80 border border-white/15 backdrop-blur-md shadow-inner">
            <button
              type="button"
              onClick={() => handleSelectPreset('all')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              )}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('this_month')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeTab === 'this_month'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              )}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('prev_month')}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                activeTab === 'prev_month'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              )}
            >
              Previous Month
            </button>
            <button
              type="button"
              onClick={() => setShowCustomInputs(!showCustomInputs)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                activeTab === 'custom' || showCustomInputs
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Custom Range</span>
              <ChevronDown className={cn('h-3 w-3 transition-transform', showCustomInputs && 'rotate-180')} />
            </button>
          </div>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="glass-button bg-slate-900/80 border-white/15 hover:border-white/30 text-white h-9 px-3.5 rounded-xl font-bold text-xs"
            title="Refresh Financial Data"
          >
            <RotateCcw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin text-indigo-400')} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Collapsible Custom Date Range Picker */}
      {showCustomInputs && (
        <div className="pt-4 border-t border-white/15 flex flex-wrap items-end gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setCustomError(null);
              }}
              className="h-9 px-3 rounded-xl bg-slate-950/90 border border-white/20 text-xs font-medium text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setCustomError(null);
              }}
              className="h-9 px-3 rounded-xl bg-slate-950/90 border border-white/20 text-xs font-medium text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleApplyCustom}
            disabled={loading}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30"
          >
            Apply Range
          </Button>
          {customError && (
            <span className="text-xs text-rose-400 font-bold pb-2">{customError}</span>
          )}
        </div>
      )}
    </div>
  );
}
