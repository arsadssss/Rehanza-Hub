"use client";

import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const PIE_COLORS = ['#6366f1', '#f43f5e', '#fbbf24', '#10b981'];

export function IntelligenceCharts({ data, loading }: any) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const pieData = [
    { name: 'RTO', value: data?.summary?.rto_rate || 0 },
    { name: 'Customer', value: data?.summary?.customer_return_rate || 0 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Return Trend - Line Chart */}
      <Card className="lg:col-span-2 border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Volume Over Time</CardTitle>
          <CardDescription>Tracking daily return counts across all selected platforms.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.return_trend} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: 'gray', fontWeight: 700 }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => format(new Date(val), 'dd MMM')}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'gray', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    labelFormatter={(val) => format(new Date(val), 'dd MMMM yyyy')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="returns" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* RTO vs Customer - Pie Chart */}
      <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Behavioral Split</CardTitle>
          <CardDescription>RTO vs Customer Returns ratio.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="h-[250px] w-full relative">
            {loading ? <Skeleton className="h-full w-full rounded-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-2xl font-black text-foreground">{data?.summary?.total_returns || 0}</p>
              <p className="text-[8px] font-black uppercase text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="flex gap-6 mt-4">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index] }} />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{entry.name} ({entry.value}%)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Worst Products - Horizontal Bar Chart */}
      <Card className="lg:col-span-3 border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Top 10 Return Offenders</CardTitle>
          <CardDescription>SKUs with highest raw return volume.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full mt-4">
            {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data?.worst_products}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 10, fill: 'gray', fontWeight: 700 }} 
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  />
                  <Bar 
                    dataKey="returns" 
                    fill="#6366f1" 
                    radius={[0, 8, 8, 0]} 
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
