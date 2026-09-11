'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/apiFetch';
import { Bell, BellRing, CheckCircle2, AlertTriangle, AlertCircle, Sparkles } from 'lucide-react';

export function NotificationSettingsCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }

    async function loadSettings() {
      setLoading(true);
      try {
        const res = await apiFetch('/api/marketplace/meesho/notifications/settings');
        if (res.ok) {
          const data = await res.json();
          if (typeof data?.settings?.enabled === 'boolean') {
            setEnabled(data.settings.enabled);
          }
        }
      } catch (err) {
        console.debug('Failed to load notification settings:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleToggle = async (newVal: boolean) => {
    setEnabled(newVal);
    setSaving(true);
    try {
      const res = await apiFetch('/api/marketplace/meesho/notifications/settings', {
        method: 'POST',
        body: JSON.stringify({ enabled: newVal }),
      });

      if (!res.ok) throw new Error('Failed to update notification settings');

      toast({
        title: newVal ? 'Order Notifications Enabled' : 'Order Notifications Disabled',
        description: newVal
          ? 'You will receive browser notifications for new Meesho pending orders.'
          : 'Browser order notifications have been turned off.',
      });
    } catch (err: any) {
      setEnabled(!newVal);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: err.message || 'Could not save notification preferences.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast({
        variant: 'destructive',
        title: 'Not Supported',
        description: 'Your browser does not support Web Notifications.',
      });
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        toast({
          title: 'Notifications Allowed',
          description: 'Browser order notifications are now active.',
        });
      } else if (result === 'denied') {
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'Notifications were blocked in your browser settings.',
        });
      }
    } catch (err: any) {
      console.error('Failed to request notification permission:', err);
    }
  };

  const handleSendTestNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast({
        variant: 'destructive',
        title: 'Not Supported',
        description: 'Your browser does not support Web Notifications.',
      });
      return;
    }

    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        toast({
          variant: 'destructive',
          title: 'Permission Required',
          description: 'Please allow notification permission to receive alerts.',
        });
        return;
      }
    }

    try {
      const testNotif = new Notification('New Meesho Order', {
        body: 'You have 1 new pending order.',
        icon: '/favicon.ico',
        tag: 'test-order-notification',
      });

      testNotif.onclick = () => {
        window.focus();
        testNotif.close();
      };

      toast({
        title: 'Test Notification Dispatched',
        description: 'Check your screen or notification center for the test alert.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Test Failed',
        description: err.message || 'Could not dispatch test notification.',
      });
    }
  };

  return (
    <Card className="glass-panel border-white/10 bg-slate-900/40 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <BellRing className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl font-headline font-bold text-white">
                Browser Order Notifications
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground text-sm">
              Get notified in real-time when new Meesho orders enter Pending status.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {permission === 'granted' && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 gap-1.5 py-1 px-3">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Allowed
              </Badge>
            )}
            {permission === 'default' && (
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 gap-1.5 py-1 px-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                Not enabled
              </Badge>
            )}
            {permission === 'denied' && (
              <Badge variant="destructive" className="gap-1.5 py-1 px-3">
                <AlertCircle className="h-3.5 w-3.5" />
                Permission Denied in Browser
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Toggle Setting Row */}
        <div className="flex flex-row items-center justify-between rounded-2xl border border-white/10 p-5 bg-background/50">
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">Browser Order Notifications</p>
            <p className="text-xs text-muted-foreground">
              Get notified when new Meesho orders enter Pending status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={loading || saving}
            />
          </div>
        </div>

        {/* Browser Permission Guidance */}
        {permission === 'default' && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-300">Browser permission required</p>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  To receive pop-up alerts on your desktop, grant notification permission to this site.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleRequestPermission}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs"
            >
              Enable Notifications
            </Button>
          </div>
        )}

        {permission === 'denied' && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-red-300">Notifications are blocked in your browser</p>
              <p className="text-[11px] text-red-200/80 mt-1">
                Your browser has blocked notifications for this site. To unblock: click the tune/lock icon in your browser address bar (next to the URL), change Notifications to <strong>Allow</strong>, and refresh the page.
              </p>
            </div>
          </div>
        )}

        {/* Test Notification Action */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div>
            <p className="text-xs font-semibold text-white">Test Browser Push</p>
            <p className="text-[11px] text-muted-foreground">
              Send a simulated "New Meesho Order" alert to verify your browser audio & pop-up delivery.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTestNotification}
            className="border-white/10 hover:bg-white/5 text-xs font-semibold gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Send Test Notification
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

