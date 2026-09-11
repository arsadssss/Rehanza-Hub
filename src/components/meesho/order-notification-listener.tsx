'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';

export function OrderNotificationListener() {
  const router = useRouter();
  const isPollingRef = useRef(false);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // 1. Register Service Worker for robust background click / focus handling
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          swRegistrationRef.current = reg;
        })
        .catch((err) => {
          console.debug('[Order Notifications] Service worker registration skipped:', err);
        });
    }
  }, []);

  // 2. Main polling routine
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    let intervalId: NodeJS.Timeout | null = null;

    const checkAndNotify = async () => {
      // Avoid overlapping requests
      if (isPollingRef.current) return;
      if (Notification.permission !== 'granted') return;

      isPollingRef.current = true;
      try {
        // First verify if browser notifications are enabled in settings
        const settingsRes = await apiFetch('/api/marketplace/meesho/notifications/settings');
        if (!settingsRes.ok) return;
        const settingsData = await settingsRes.json();
        if (settingsData?.settings?.enabled === false) {
          return;
        }

        // Poll for pending undelivered notifications
        const pollRes = await apiFetch('/api/marketplace/meesho/notifications?limit=50');
        if (!pollRes.ok) return;
        const pollData = await pollRes.json();

        const notifications = pollData.notifications || [];
        if (!Array.isArray(notifications) || notifications.length === 0) {
          return;
        }

        const count = notifications.length;
        const title = count === 1 ? 'New Meesho Order' : 'New Meesho Orders';
        const body =
          count === 1
            ? 'You have 1 new pending order.'
            : `You have ${count} new pending orders.`;

        // Trigger notification via Service Worker registration if available, or direct Notification API
        if (swRegistrationRef.current && 'showNotification' in swRegistrationRef.current) {
          await swRegistrationRef.current.showNotification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'meesho-pending-order',
            data: { url: '/orders' },
          });
        } else {
          const notif = new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'meesho-pending-order',
          });

          notif.onclick = (e) => {
            e.preventDefault();
            window.focus();
            router.push('/orders');
            notif.close();
          };
        }

        // Play subtle pleasant chime
        playNotificationChime();

        // Immediately acknowledge delivered notification IDs to the server
        const notificationIds = notifications.map((n: any) => n.id);
        await apiFetch('/api/marketplace/meesho/notifications', {
          method: 'POST',
          body: JSON.stringify({ notificationIds }),
        });
      } catch (err) {
        console.debug('[Order Notifications] Poll error:', err);
      } finally {
        isPollingRef.current = false;
      }
    };

    // Poll every 30 seconds
    intervalId = setInterval(checkAndNotify, 30000);

    // Also check immediately when user focuses the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndNotify();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial check after short delay
    const initialTimer = setTimeout(checkAndNotify, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      clearTimeout(initialTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  return null;
}

/**
 * Web Audio API gentle notification chime (zero external audio files needed)
 */
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // Pleasant two-tone chime (F#5 to A5)
    osc1.frequency.setValueAtTime(739.99, ctx.currentTime);
    osc2.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.45);
  } catch {}
}

