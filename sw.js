// -------------------------------------------------------
// SkySpine - Service Worker
// Je gere le cache hors ligne pour que le jeu fonctionne
// sans connexion internet apres le premier chargement.
// -------------------------------------------------------

const CACHE_NAME = 'skyspine-v2';

// Je liste tous les fichiers que je dois mettre en cache
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',

  // CSS
  '/css/base.css',
  '/css/components.css',
  '/css/screens.css',
  '/css/game.css',

  // JS modules
  '/js/app.js',
  '/js/db.js',
  '/js/assets.js',
  '/js/controls.js',
  '/js/weather.js',
  '/js/obstacles.js',
  '/js/collision.js',
  '/js/renderer.js',
  '/js/game.js',

  // Images
  '/assets/biplane.png',
  '/assets/avion_bleu.png',
  '/assets/explosion_2d.png',
  '/assets/skypine.png',
  '/assets/backgrounds/background_plage.png',
  '/assets/backgrounds/village.png',
  '/assets/ennemis/avion_rouge.png',
  '/assets/ennemis/nuage_eclair.png',
  '/assets/ennemis/oiseau_1_gauche.png',
  '/assets/ennemis/oiseau_2_gauche.png',

  // SVG
  '/assets/svg/chevron-left.svg',
  '/assets/svg/download-cloud.svg',
  '/assets/svg/gear-solid-full.svg',
  '/assets/svg/house-regular-full.svg'
];

// Je mets tout en cache lors de l'installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Je supprime les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Je sers les fichiers depuis le cache en priorite (cache-first)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
