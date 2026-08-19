// Şakül service worker — Stage 0: minimal, exists so the PWA is installable
// and so the push handler (Stage 2) and offline shell (Stage 5) have a home.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
