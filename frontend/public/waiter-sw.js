/**
 * AVORA Waiter POS - Offline-First Service Worker v4
 * Chiến lược:
 * 1. Navigation: Network-First với Cache-Fallback vào App Shell (/admin/pos/waiter)
 * 2. Next.js Static Chunks (_next/static): Network-First với Cache-Fallback (tránh giữ UI phiên bản cũ)
 * 3. Static Assets (hình ảnh, biểu tượng, fonts): Cache-First
 * 4. API & WebSocket (/api/*, socket.io): Network-Only (dữ liệu nghiệp vụ quản lý qua IndexedDB)
 * 5. Push Notifications & Safe Invalidation
 */

const CACHE_VERSION = 'v6';
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

  // 2. Navigation Request: Chỉ xử lý App Shell cho Waiter POS (/admin/pos/waiter hoặc /waiter)
  // Tuyệt đối không can thiệp vào các route của khách hàng như /qr/*, /checkout/*, trang chủ...
  if (request.mode === 'navigate' || request.destination === 'document') {
    const isWaiterRoute =
      url.pathname.startsWith('/admin/pos/waiter') ||
      url.pathname.startsWith('/waiter');

    if (!isWaiterRoute) {
      // Để trình duyệt & Next.js App Router xử lý client navigation tự nhiên, không can thiệp SW
      return;
    }

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

  // 3. Next.js Static Bundles (_next/static/...) - Network-First để luôn nhận giao diện mới nhất khi online
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
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
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'AVORA Waiter',
        body: event.data.text() || 'Bạn có thông báo mới',
      };
    }
  }

  const title = data.title || 'AVORA Waiter';
  const body = data.body || 'Bạn có thông báo nghiệp vụ mới';
  const icon = data.icon || '/avora_logo.png';
  const badge = data.badge || '/avora_logo.png';
  const tag = data.eventId || (data.category ? `avora-${data.category.toLowerCase()}` : 'avora-waiter-push');

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: data.category === 'SERVICE_REQUESTS' || data.category === 'PAYMENTS',
    data: {
      targetPath: data.targetPath || '/admin/pos/waiter',
      eventId: data.eventId,
      notificationId: data.notificationId,
      category: data.category,
      branchId: data.branchId,
      createdAt: data.createdAt,
    },
    vibrate: [250, 100, 250, 100, 250],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Inform any foreground windows of the push event for real-time sound / refresh
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({
            type: 'WEB_PUSH_RECEIVED',
            payload: data,
          });
        });
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  let targetPath = notificationData.targetPath || '/admin/pos/waiter';

  // Strict local origin protection: do not allow external redirect URLs
  if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
    try {
      const parsed = new URL(targetPath);
      targetPath = parsed.pathname + parsed.search + parsed.hash;
    } catch {
      targetPath = '/admin/pos/waiter';
    }
  }

  if (!targetPath.startsWith('/')) {
    targetPath = '/admin/pos/waiter';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an AVORA Waiter window is already open, focus it and trigger view navigation
      for (const client of clientList) {
        if (client.url && client.url.includes('/admin/pos/waiter') && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_NAVIGATE',
            targetPath,
            data: notificationData,
          });
          return;
        }
      }

      // 2. Otherwise open a new window to the target path
      if (clients.openWindow) {
        return clients.openWindow(targetPath);
      }
    })
  );
});
