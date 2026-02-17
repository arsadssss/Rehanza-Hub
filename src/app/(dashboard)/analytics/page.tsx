import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Analytics</CardTitle>
          <CardDescription>
            Deep dive into your business performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Advanced analytics and reporting will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
