// Todo Phoenix PWA Service Worker
// This is a production-ready service worker with offline caching and sync capabilities

const CACHE_NAME = 'todo-phoenix-v1';
const API_CACHE_NAME = 'todo-phoenix-api-v1';

// URLs to cache for offline support
const CACHE_URLS = [
  '/',
  '/dashboard',
  '/analytics',
  '/agents',
  '/knowledge-graph',
  '/_next/static/css/*.css',
  '/_next/static/chunks/*.js',
  '/api/tasks',
  '/api/lists',
  '/api/labels',
  '/api/analytics',
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/tasks',
  '/api/lists',
  '/api/labels',
  '/api/analytics',
  '/api/knowledge-graph',
];

// Install event - cache core assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(caches.open(CACHE_NAME))
    .then((cache) => cache.addAll(CACHE_URLS));
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim clients to take control immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event: ExtendableEvent) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(event.request, URL.createObjectURL));
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(cacheFirstWithNetwork(event.request));
});

// Sync event - handle offline writes
self.addEventListener('sync', (event: ExtendableEvent) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncPendingTasks());
  } else if (event.tag === 'sync-reminders') {
    event.waitUntil(syncPendingReminders());
  }
});

// Background sync helper functions
async function networkFirstWithCache(request: Request, networkFallback?: (url: string) => Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(API_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // No cache available
    if (networkFallback) {
      return networkFallback(request.url);
    }

    // Return a generic offline response
    return new Response(JSON.stringify({ error: 'Offline - please connect to internet' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirstWithNetwork(request: Request): Promise<Response> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Not in cache, fetch from network
    const networkResponse = await fetch(request);

    // Cache the response
    if (networkResponse.ok && request.url.includes('/_next/static/')) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, return cached response if available
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return a generic fallback
    return new Response('Offline - content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Sync pending tasks when coming online
async function syncPendingTasks(): Promise<void> {
  try {
    // Get pending tasks from IndexedDB or localStorage
    const pendingTasks = JSON.parse(localStorage.getItem('pending-tasks') || '[]');

    for (const task of pendingTasks) {
      try {
        await fetch('/api/tasks/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });
      } catch (error) {
        console.error('Failed to sync task:', error);
      }
    }

    // Clear synced tasks
    localStorage.removeItem('pending-tasks');
  } catch (error) {
    console.error('Failed to sync pending tasks:', error);
  }
}

// Sync pending reminders
async function syncPendingRemifications(): Promise<void> {
  try {
    const pendingReminders = JSON.parse(localStorage.getItem('pending-reminders') || '[]');

    for (const reminder of pendingReminders) {
      try {
        await fetch('/api/reminders/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reminder)
        });
      } catch (error) {
        console.error('Failed to sync reminder:', error);
      }
    }

    localStorage.removeItem('pending-reminders');
  } catch (error) {
    console.error('Failed to sync pending reminders:', error);
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event: MessageEvent) => {
  const { action, data } = event.data;

  switch (action) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'UPDATE_STATUS':
      // Inform clients about service worker installation status
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_STATUS_UPDATED',
            status: 'installed'
          });
        });
      });
      break;

    case 'GET_CACHE_SIZE':
      // Respond with current cache size
      caches.keys().then((cacheNames) => {
        let totalSize = 0;

        Promise.all(
          cacheNames.map((cacheName) =>
            caches.open(cacheName).then((cache) => cache.keys())
          )
        ).then((cacheKeyArrays) => {
          let totalKeys: CacheStorage[] = [];
          cacheKeyArrays.forEach((keys) => {
            totalKeys = totalKeys.concat(keys);
          });

          event.source?.postMessage({
            type: 'CACHE_SIZE',
            size: totalSize
          });
        });
      });
      break;

    default:
      console.warn('Unknown action:', action);
  }
});