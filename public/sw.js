// Service Worker per FantAssisi 2026
const CACHE_NAME = 'fantassisi-v2';
const urlsToCache = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Installazione: precarica solo gli asset statici (mai le pagine, che devono
// restare sempre aggiornate) e attiva subito la nuova versione.
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Attivazione: elimina le cache delle versioni precedenti e prende subito
// il controllo delle pagine già aperte, senza aspettare la chiusura dei tab.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first. Finché c'è connessione i dati sono sempre freschi
// (fondamentale, cambiano in continuazione durante l'evento); la cache serve
// solo come fallback se il dispositivo va offline.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
