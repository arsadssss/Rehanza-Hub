'use client';

import * as React from 'react';
import { Pie, PieChart, Sector } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from '@/components/ui/chart';

const chartData = [
  { channel: 'Meesho', orders: 275, fill: 'var(--color-meesho)' },
  { channel: 'Flipkart', orders: 200, fill: 'var(--color-flipkart)' },
  { channel: 'Amazon', orders: 187, fill: 'var(--color-amazon)' },
];

const chartConfig = {
  orders: {
    label: 'Orders',
  },
  meesho: {
    label: 'Meesho',
    color: 'hsl(var(--chart-1))',
  },
  flipkart: {
    label: 'Flipkart',
    color: 'hsl(var(--chart-2))',
  },
  amazon: {
    label: 'Amazon',
    color: 'hsl(var(--chart-3))',
  },
};

export function ChannelChart() {
  return (
    <div className="h-[350px] w-full flex items-center justify-center">
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square h-full"
      >
        <PieChart>
          <ChartTooltipContent
            hideLabel
            nameKey="orders"
            formatter={(value, name, item) => `${item.payload.channel}: ${value}`}
          />
          <Pie
            data={chartData}
            dataKey="orders"
            nameKey="channel"
            innerRadius={60}
            strokeWidth={5}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
