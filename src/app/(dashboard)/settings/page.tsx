import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Settings</CardTitle>
          <CardDescription>
            Configure your application settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Application settings will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
