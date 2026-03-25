const CACHE_NAME = 'ibt-mesh-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://unpkg.com/feather-icons',
    'https://cdn.jsdelivr.net/npm/gun/gun.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
