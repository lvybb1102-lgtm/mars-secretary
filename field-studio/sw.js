/* 잉크원_st_AI — 오프라인 껍데기 캐시 (네트워크 우선, 실패 시 캐시)
   v3: P2 발행 어댑터(네이버·Blogger·니케 발행팩·로컬 브릿지) 반영
   범위는 ./ (field-studio) 안으로 한정한다. 상위 비서실 SW와 충돌하지 않게 자기 파일만 다룬다. */
const CACHE = 'ink1-field-studio-v3';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Gemini API 등 외부 요청은 건드리지 않는다
  if (!url.pathname.includes('/field-studio')) return;   // 내 범위 밖은 통과
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
