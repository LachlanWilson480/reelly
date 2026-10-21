// Minimal service worker so Reelezy can be installed as an app.
// It does not cache anything, so users always get the latest version after a deploy.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
