import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ReturnsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Returns</CardTitle>
          <CardDescription>
            Process and track customer returns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Returns management interface will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
