'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { formatCurrency } from '@/lib/format';

const chartData = [
  { date: '2024-07-15', revenue: 12345 },
  { date: '2024-07-16', revenue: 15432 },
  { date: '2024-07-17', revenue: 18765 },
  { date: '2024-07-18', revenue: 16234 },
  { date: '2024-07-19', revenue: 20456 },
  { date: '2024-07-20', revenue: 22123 },
  { date: '2024-07-21', revenue: 25678 },
];

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
};

export function SalesChart() {
  return (
    <div className="h-[350px] w-full">
      <ChartContainer config={chartConfig} className="w-full h-full">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => formatCurrency(value as number)}
          />
          <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number)} />} />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={8} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
