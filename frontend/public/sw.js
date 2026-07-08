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
  // 모바일 Safari 등 일부 브라우저에서 기존 Request 객체에 cache: 'no-store' 옵션을 지정해 fetch를 호출하면
  // TypeError가 발생하여 페이지 로드가 차단되는 문제가 있습니다. 
  // 안전하게 e.request 그대로 fetch를 수행합니다.
  e.respondWith(fetch(e.request));
});

