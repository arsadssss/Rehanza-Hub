import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function InventoryPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Inventory</CardTitle>
          <CardDescription>
            Track and manage your stock levels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Inventory management interface will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
