/**
 * AVORA Waiter POS - Offline-First Service Worker v3
 * Chiến lược:
 * 1. Navigation: Network-First với Cache-Fallback vào App Shell (/admin/pos/waiter)
 * 2. Next.js Static Chunks (_next/static): Cache-First / Stale-While-Revalidate
 * 3. Static Assets (hình ảnh, biểu tượng, fonts): Cache-First
 * 4. API & WebSocket (/api/*, socket.io): Network-Only (dữ liệu nghiệp vụ quản lý qua IndexedDB)
 * 5. Push Notifications & Safe Invalidation
 */

const CACHE_VERSION = 'v3';
const CACHE_SHELL = `avora-waiter-shell-${CACHE_VERSION}`;
const CACHE_STATIC = `avora-waiter-static-${CACHE_VERSION}`;
const CURRENT_CACHES = [CACHE_SHELL, CACHE_STATIC];

const SHELL_URL = '/admin/pos/waiter';

const PRECACHE_ASSETS = [
  SHELL_URL,
  '/waiter-manifest.json',
  '/avora_logo.png',
  '/avora_logo_ngang.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then(async (cache) => {
      // Precache app shell and critical branding
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[Waiter SW] Precache failed for ${asset}:`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('avora-waiter-') && !CURRENT_CACHES.includes(key)) {
            console.log(`[Waiter SW] Deleting obsolete cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Chỉ xử lý phương thức GET cùng origin
  if (request.method !== 'GET') {
    return;
  }

  // 1. Tuyệt đối không can thiệp API calls, WebSocket, SSR RSC data
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('socket.io') ||
    url.searchParams.has('_rsc')
  ) {
    return;
  }

  // 2. Navigation Request: Network-First với fallback sang App Shell
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_SHELL).then((cache) => {
              cache.put(SHELL_URL, copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[Waiter SW] Network down during navigation, serving cached App Shell');
          const cachedShell = await caches.match(SHELL_URL);
          if (cachedShell) {
            return cachedShell;
          }
          // Fallback nếu không có exact match
          return caches.match('/');
        })
    );
    return;
  }

  // 3. Next.js Static Bundles (_next/static/...)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Trả về ngay lập tức, tải nền để cập nhật nếu có
          fetch(request).then((netRes) => {
            if (netRes && netRes.status === 200) {
              caches.open(CACHE_STATIC).then((cache) => cache.put(request, netRes));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Static Media (Images, Fonts, Audio, Icons)
  const isStaticAsset =
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.mp3');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        }).catch(() => {
          return new Response('', { status: 408, statusText: 'Resource unavailable offline' });
        });
      })
    );
    return;
  }
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
        if (client.url && client.url.includes('/admin/pos/waiter') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/admin/pos/waiter');
      }
    })
  );
});
