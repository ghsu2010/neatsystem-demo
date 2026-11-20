// Minimal service worker so the app is installable. It caches nothing:
// NeatSystem has no offline mode (NeatSystem 1.3) — every request goes to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
