"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatINRWithDecimals } from "@/lib/format";
import { TrendingUp, BarChart3, Calendar } from "lucide-react";

interface PaymentsGraphTabProps {
  graph?: {
    payouts: Array<{
      payment_date: string;
      net_amount: number | null;
      payout_status: string;
      payout_breakup: {
        total_net_order: number | null;
        ads_cost: number | null;
        referral: number | null;
      };
    }>;
  };
}

export function PaymentsGraphTab({ graph }: PaymentsGraphTabProps) {
  const rawPayouts = graph?.payouts || [];

  // Sort ascending by payment_date
  const chartData = [...rawPayouts]
    .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
    .map((item) => {
      const d = new Date(item.payment_date);
      const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return {
        date: item.payment_date,
        displayDate: label,
        netAmount: Number(item.net_amount || 0),
        orderAmount: Number(item.payout_breakup?.total_net_order || 0),
        adsCost: Number(item.payout_breakup?.ads_cost || 0),
        status: item.payout_status || "PENDING",
      };
    });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg text-xs space-y-1.5 min-w-[180px]">
          <div className="flex items-center justify-between border-b border-border/70 pb-1">
            <span className="font-semibold text-foreground">{data.date}</span>
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1 font-mono uppercase"
            >
              {data.status}
            </Badge>
          </div>
          <div className="flex justify-between text-muted-foreground pt-0.5">
            <span>Net Settlement:</span>
            <span className="font-mono font-bold text-foreground">
              {formatINRWithDecimals(data.netAmount)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Orders Amount:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {formatINRWithDecimals(data.orderAmount)}
            </span>
          </div>
          {data.adsCost > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Ads Deductions:</span>
              <span className="font-mono text-rose-600 dark:text-rose-400">
                -{formatINRWithDecimals(data.adsCost)}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Settlements Timeline
            </CardTitle>
            <CardDescription className="text-xs">
              Daily net payout progression extracted directly from Meesho panel graph
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs gap-1 self-start sm:self-center">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            {chartData.length} Daily Data Points
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-6">
        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
            <BarChart3 className="w-10 h-10 text-muted-foreground opacity-50" />
            <p className="text-xs text-muted-foreground">
              No timeline graph data available for this account.
            </p>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="payoutGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#db2777" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#db2777" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="netAmount"
                  stroke="#db2777"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#payoutGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

