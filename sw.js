self.addEventListener('install', (e) => {
  self.skipWaiting(); // 설치 즉시 활성화
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key))); // 기존 캐시 싹 제거
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // 캐시 무시하고 네트워크에서 먼저 가져오기
  e.respondWith(fetch(e.request));
});
