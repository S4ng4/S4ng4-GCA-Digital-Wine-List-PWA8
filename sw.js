/**
 * Service Worker for Gran Caffè L'Aquila - Wine List PWA
 * Handles caching for offline functionality
 */

const CACHE_NAME = 'gca-wine-list-v5';
const CACHE_VERSION = 'v1.2.2';

// Core assets to cache immediately on install
const CORE_ASSETS = [
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/subcategory-helper.js',
  'js/wineries.js',
  'manifest.json'
];

// Additional pages to cache
const PAGE_ASSETS = [
  'wines.html',
  'wine-map.html',
  'wine-details.html',
  'wine-details-tlc11.html',
  'WineByTheGlass.html',
  'OurStory.html',
  'regions.html',
  'SparklingWineDoc.html',
  'wine-comparison.html',
  'wine_manager.html',
  '404.html'
];

// Images to cache
const IMAGE_ASSETS = [
  'image/gcaLogo.png',
  'image/gcaLogo.webp',
  'image/gcaLogoWall.jpeg',
  'image/gcaLogoWall.webp',
  'image/logoFull.svg',
  'image/secondFloor.png',
  'image/secondFloor.webp',
  'image/OldGca.jpg',
  'image/OldGca.webp',
  'image/gl00.png',
  'image/gl00.webp',
  'image/glArancione.png',
  'image/glArancione.webp',
  'image/glassRed.png',
  'image/glassRed.webp',
  'image/glassWhite.png',
  'image/glassWhite.webp',
  'image/glRose.png',
  'image/glRose.webp',
  'image/glSparkling.png',
  'image/glSparkling.webp',
  'image/Ancestral-PetNat.svg',
  'image/Martinotti.svg',
  'image/MetodoClassico.svg'
];

// Data files to cache
const DATA_ASSETS = [
  'data/wines.json',
  'data/FoodParingWineDetails.json',
  'data/gca_wine_link.json'
];

// External CDN resources (cached on first request)
const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant:wght@300;400;500;600&display=swap'
];

// Combine all local assets
const ALL_LOCAL_ASSETS = [
  ...CORE_ASSETS,
  ...PAGE_ASSETS,
  ...IMAGE_ASSETS,
  ...DATA_ASSETS
];

/**
 * Install Event - Cache core assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets...');
        // Cache core assets first (critical for offline)
        return cache.addAll(CORE_ASSETS)
          .then(() => {
            console.log('[SW] Core assets cached successfully');
            // Then cache additional assets (non-blocking)
            return Promise.allSettled([
              ...PAGE_ASSETS.map(url => cache.add(url).catch(err => console.log(`[SW] Failed to cache ${url}:`, err))),
              ...IMAGE_ASSETS.map(url => cache.add(url).catch(err => console.log(`[SW] Failed to cache ${url}:`, err))),
              ...DATA_ASSETS.map(url => cache.add(url).catch(err => console.log(`[SW] Failed to cache ${url}:`, err)))
            ]);
          });
      })
      .then(() => {
        console.log('[SW] All assets cached');
        // Force the waiting service worker to become active
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache assets:', error);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

/**
 * Fetch Event - Serve from cache, fallback to network
 * Strategy: Cache-First for static assets, Network-First for API/data
 */
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests
  if (requestUrl.protocol === 'chrome-extension:') {
    return;
  }
  
  // Bypass SW on localhost so fetches go to the server; avoids 503 from createOfflineResponse
  // when network fails (wrong server root, server down) and cache miss.
  if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
    return;
  }
  
  // Handle different resource types with appropriate strategies
  if (isStaticAsset(requestUrl)) {
    // Cache-First strategy for static assets
    event.respondWith(cacheFirst(event.request));
  } else if (isCDNResource(requestUrl)) {
    // Stale-While-Revalidate for CDN resources
    event.respondWith(staleWhileRevalidate(event.request));
  } else if (isDataFile(requestUrl)) {
    // Network-First for data files (to get latest data)
    event.respondWith(networkFirst(event.request));
  } else {
    // Default: Network-First with cache fallback
    event.respondWith(networkFirst(event.request));
  }
});

/**
 * Cache-First Strategy
 * Good for: Static assets that rarely change
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network request failed, no cache available:', request.url);
    return createOfflineResponse(request);
  }
}

/**
 * Network-First Strategy
 * Good for: Data that might change frequently
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    // #region agent log
    var u = new URL(request.url);
    if (u.pathname.includes('/data/wines.json')) {
      (function(){
        var p = {location:'sw.js:networkFirst:createOffline',message:'SW returning 503 for wines.json',data:{url:request.url,hadCache:!!cachedResponse},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'h1'};
        try { console.log('[DEBUG]', JSON.stringify(p)); } catch(e) {}
        fetch('http://127.0.0.1:7247/ingest/fe36653c-3e53-480d-b7e2-efd99bb3957a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).catch(function(){});
      })();
    }
    // #endregion
    return createOfflineResponse(request);
  }
}

/**
 * Stale-While-Revalidate Strategy
 * Good for: CDN resources that are mostly static
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[SW] Failed to fetch CDN resource:', request.url);
      return null;
    });
  
  return cachedResponse || fetchPromise;
}

/**
 * Create offline fallback response
 */
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  // For HTML pages, return the cached index or 404
  if (request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html')) {
    return caches.match('/index.html')
      .then((response) => response || new Response(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Offline - Gran Caffè L'Aquila</title>
          <style>
            body {
              font-family: 'Cormorant', Georgia, serif;
              background: #0E0E0E;
              color: #F2F2F2;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              text-align: center;
              padding: 20px;
            }
            .offline-container {
              max-width: 400px;
            }
            h1 {
              color: #D4AF37;
              font-family: 'Cinzel', serif;
              font-size: 1.8rem;
              margin-bottom: 1rem;
            }
            p {
              color: rgba(245, 245, 240, 0.8);
              line-height: 1.6;
            }
            .icon {
              font-size: 3rem;
              margin-bottom: 1rem;
              opacity: 0.6;
            }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="icon">📶</div>
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again. Some content may still be available from cache.</p>
          </div>
        </body>
        </html>`,
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/html' }
        }
      ));
  }
  
  // For other resources, return a simple error
  return new Response('Offline - Resource not available', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

/**
 * Helper: Check if URL is a static asset
 */
function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) || 
         url.pathname.endsWith('.html') ||
         url.pathname === '/';
}

/**
 * Helper: Check if URL is a CDN resource
 */
function isCDNResource(url) {
  const cdnHosts = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  return cdnHosts.some(host => url.hostname.includes(host));
}

/**
 * Helper: Check if URL is a data file
 */
function isDataFile(url) {
  return url.pathname.endsWith('.json') && url.pathname.includes('/data/');
}

/**
 * Listen for messages from the main app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // Check if ports array exists and has at least one port
    if (event.ports && event.ports.length > 0 && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_VERSION });
    }
  }
});

console.log('[SW] Service Worker script loaded');
