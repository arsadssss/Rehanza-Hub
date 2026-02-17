import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description: string;
  gradient: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  gradient,
}: StatCardProps) {
  return (
    <Card
      className={`text-white bg-gradient-to-r ${gradient} shadow-xl rounded-2xl border-0`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-white/80" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-headline">{value}</div>
        <p className="text-xs text-white/80">{description}</p>
      </CardContent>
    </Card>
  );
}
