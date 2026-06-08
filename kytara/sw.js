const CACHE_NAME = 'matysguitar-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/pages/home.html',
  '/pages/about.html',
  '/pages/chords.html',
  '/pages/gallery.html',
  '/fotky/logo.png',
  '/fotky/kolo.png',
  '/fotky/hmatnik.png',
  '/fotky/pozadi.png',
  '/fotky/sipkaVlevo.png',
  '/fotky/sipkaVpravo.png',
  '/fotky/oddeleni.png'
];

// Instalace – uložení souborů do cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // aktivuje SW hned
  );
});

// Aktivace – smazání starých cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim()) // převezme kontrolu ihned
  );
});

// Fetch – nejdřív cache, pak síť (offline podpora)
self.addEventListener('fetch', event => {
  // API požadavky necháme jít přímo na síť (neukládáme)
  if (event.request.url.includes('api.lyrics.ovh') ||
      event.request.url.includes('api.uberchord.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // vrátí z cache
        }
        return fetch(event.request).then(networkResponse => {
          // Uložíme jen odpovědi ze stejného originu
          if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
      .catch(() => {
        // Fallback pro offline – pouze pro HTML stránky
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/pages/home.html');
        }
      })
  );
});