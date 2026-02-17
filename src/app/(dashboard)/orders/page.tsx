import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function OrdersPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Orders</CardTitle>
          <CardDescription>
            View and manage customer orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Order management interface will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
