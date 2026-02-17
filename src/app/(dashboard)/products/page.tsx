import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ProductsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Products</CardTitle>
          <CardDescription>
            Manage your products and their pricing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Product management interface will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
