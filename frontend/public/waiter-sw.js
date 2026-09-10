const CACHE_NAME = 'avora-waiter-cache-v1';
const OFFLINE_URL = '/admin/pos/waiter';

const STATIC_ASSETS = [
  '/',
  '/admin/pos/waiter',
  '/avora_logo_ngang.png',
  '/avora_logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Bỏ qua các API call không thuộc GET
  if (request.method !== 'GET') {
    return;
  }

  // Bỏ qua các API tài chính / realtime
  if (url.pathname.startsWith('/api/pos') || url.pathname.includes('socket.io')) {
    return;
  }

  // Trả về từ cache trước, fallback network cho các tài nguyên tĩnh
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).catch(() => {
        // Fallback offline cho route waiter
        if (request.mode === 'navigate' && url.pathname.startsWith('/admin/pos/waiter')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AVORA Waiter';
  const options = {
    body: data.body || 'Bạn có thông báo mới',
    icon: '/avora_logo.png',
    badge: '/avora_logo.png',
    data: data,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/admin/pos/waiter');
      }
    })
  );
});
