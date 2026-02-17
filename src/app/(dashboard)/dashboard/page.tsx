import { StatCard } from './components/stat-card';
import { SalesChart } from './components/sales-chart';
import { ChannelChart } from './components/channel-chart';
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  PackageX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from './components/date-range-picker';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';

const recentOrders = [
  {
    orderId: '#FL-1234',
    channel: 'Flipkart',
    amount: formatCurrency(1250),
    status: 'Delivered',
  },
  {
    orderId: '#AMZ-5678',
    channel: 'Amazon',
    amount: formatCurrency(890.50),
    status: 'Returned',
  },
  {
    orderId: '#ME-9101',
    channel: 'Meesho',
    amount: formatCurrency(450),
    status: 'Delivered',
  },
  {
    orderId: '#FL-1112',
    channel: 'Flipkart',
    amount: formatCurrency(2100),
    status: 'RTO',
  },
    {
    orderId: '#AMZ-1314',
    channel: 'Amazon',
    amount: formatCurrency(620),
    status: 'Delivered',
  },
];

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-6 p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard
            </h1>
            <p className="text-muted-foreground">
            Here's a quick overview of your business performance.
            </p>
        </div>
        <div className="flex items-center gap-2">
            <DateRangePicker />
            <Button>Download Report</Button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
          value="1,245"
          icon={ShoppingCart}
          description="+20.1% from last month"
          gradient="from-violet-500 to-purple-500"
        />
        <StatCard
          title="Today Revenue"
          value={formatCurrency(45231.89)}
          icon={DollarSign}
          description="+180.1% from last week"
          gradient="from-blue-500 to-sky-500"
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(12234.50)}
          icon={TrendingUp}
          description="+19% from last month"
          gradient="from-emerald-500 to-green-500"
        />
        <StatCard
          title="Low Stock SKUs"
          value="12"
          icon={PackageX}
          description="3 need immediate restocking"
          gradient="from-amber-500 to-orange-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="font-headline">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="font-headline">Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ChannelChart />
          </CardContent>
        </Card>
      </div>

       <Card className="shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="font-headline">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => (
                <TableRow key={order.orderId}>
                  <TableCell className="font-medium">{order.orderId}</TableCell>
                  <TableCell>{order.channel}</TableCell>
                  <TableCell>{order.amount}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        order.status === 'Delivered'
                          ? 'default'
                          : order.status === 'Returned'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className={`${order.status === 'Delivered' ? 'bg-green-500' : ''}`}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
