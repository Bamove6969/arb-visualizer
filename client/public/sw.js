const CACHE_NAME = 'arb-visualizer-v1';
const RUNTIME_CACHE = 'arb-visualizer-runtime';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for API responses

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-192.svg',
  '/icon-512.svg',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests - network-first with intelligent caching
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful API responses
          if (response && response.ok) {
            const responseClone = response.clone();
            const now = Date.now();
            
            // Add timestamp to cached response
            caches.open(RUNTIME_CACHE).then(cache => {
              const headers = new Headers(responseClone.headers);
              headers.set('sw-cached-at', now.toString());
              
              const modifiedResponse = new Response(responseClone.body, {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: headers
              });
              
              cache.put(request, modifiedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - try cache with TTL check
          return caches.open(RUNTIME_CACHE)
            .then(cache => cache.match(request))
            .then(cached => {
              if (cached) {
                const cachedAt = cached.headers.get('sw-cached-at');
                const now = Date.now();
                
                // Check if cache is still valid (within TTL)
                if (cachedAt && (now - parseInt(cachedAt)) < CACHE_TTL) {
                  // Add offline indicator header
                  const headers = new Headers(cached.headers);
                  headers.set('X-Offline-Data', 'true');
                  
                  return cached.clone();
                }
              }
              
              // No valid cache - return offline error
              return new Response(JSON.stringify({
                error: 'Offline',
                message: 'No network connection. Some features may be unavailable.',
                cached: false
              }), {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Offline-Data': 'false'
                }
              });
            });
        })
    );
    return;
  }

  // Static assets - cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail for documents, return index
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});
