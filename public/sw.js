// Service Worker for Rehanza-Hub Notifications
// Phase 2D: Meesho Live Order Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and optionally navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url && client.url.includes(targetUrl)) {
            return client.focus();
          }
        }
      }
      if (clientList.length > 0 && 'focus' in clientList[0]) {
        const client = clientList[0];
        client.focus();
        if ('navigate' in client) {
          return client.navigate(targetUrl);
        }
        return client;
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : 'You have a new order.' };
  }

  const title = data.title || 'New Meesho Order';
  const options = {
    body: data.body || 'You have a new pending order.',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'meesho-order-notification',
    data: {
      url: data.url || '/orders',
      ...data,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

