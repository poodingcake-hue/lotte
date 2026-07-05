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
  if (e.request.method === 'GET') {
    // 브라우저 캐시를 완전히 무시하고 항상 최신 버전을 서버에서 가져옴 (초기 접속 시 업데이트 보장)
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => fetch(e.request))
    );
  } else {
    e.respondWith(fetch(e.request));
  }
});
