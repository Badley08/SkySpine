// -------------------------------------------------------
// SkySpine - Service Worker
// Cache hors ligne - strategie cache-first.
// -------------------------------------------------------

const CACHE_NAME = 'skyspine-v3';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',

    '/css/base.css',
    '/css/components.css',
    '/css/screens.css',
    '/css/game.css',

    '/js/app.js',
    '/js/db.js',
    '/js/assets.js',
    '/js/controls.js',
    '/js/weather.js',
    '/js/obstacles.js',
    '/js/collision.js',
    '/js/renderer.js',
    '/js/game.js',
    '/js/firebase.js',
    '/js/planes.js',
    '/js/quests.js',
    '/js/sound.js',

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

    '/assets/svg/chevron-left.svg',
    '/assets/svg/download-cloud.svg',
    '/assets/svg/gear-solid-full.svg',
    '/assets/svg/house-regular-full.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(cacheNames.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('firestore.googleapis.com') ||
        event.request.url.includes('firebase')) {
        return;
    }
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            });
        })
    );
});
