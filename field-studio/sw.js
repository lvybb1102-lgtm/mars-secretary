/* 잉크원_st_AI — 오프라인 껍데기 캐시 (네트워크 우선, 실패 시 캐시) + 공유받기(share_target) 수신
   v6: 원고 사진을 IndexedDB(ink1_field_studio_db)에 보관 → 최근 원고 [열기] 때 사진까지 복원
   v5: 비공개 GitHub 큐 원클릭 바로발행(사진 → pack.json → ready.json) 반영
   범위는 ./ (field-studio) 안으로 한정한다. 상위 비서실 SW와 충돌하지 않게 자기 파일만 다룬다. */
const CACHE = 'ink1-field-studio-v6';
const SHARE = 'ink1-field-studio-share-v1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

/* 공유받은 사진을 앱이 꺼내 갈 주소 (scope 안의 가상 경로) */
const shareUrl = (p) => new URL('./__share__/' + p, self.registration.scope).href;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function clearShare() {
  const c = await caches.open(SHARE);
  const keys = await c.keys();
  await Promise.all(keys.map((k) => c.delete(k)));
}

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'ink1-share-clear') {
    const job = clearShare();
    if (e.waitUntil) e.waitUntil(job);
  }
});

/* 갤러리 → 공유 → 잉크원_st_AI : POST multipart 로 들어온 사진·글을 캐시에 받아 두고 앱으로 넘긴다 */
async function receiveShare(req) {
  const form = await req.formData();
  const files = form.getAll('files').filter((f) => f && typeof f !== 'string' && f.size);
  const text = String(form.get('text') || '');
  const title = String(form.get('title') || '');
  const c = await caches.open(SHARE);
  const old = await c.keys();
  await Promise.all(old.map((k) => c.delete(k)));
  const n = Math.min(files.length, 10);
  for (let i = 0; i < n; i++) {
    const f = files[i];
    const name = f.name || ('share_' + (i + 1) + '.jpg');
    await c.put(shareUrl('f' + i), new Response(f, {
      headers: {
        'Content-Type': f.type || 'image/jpeg',
        'X-Ink1-Name': encodeURIComponent(name)
      }
    }));
  }
  await c.put(shareUrl('meta'), new Response(
    JSON.stringify({ at: Date.now(), count: n, text: text, title: title }),
    { headers: { 'Content-Type': 'application/json' } }
  ));
  return Response.redirect(new URL('./?shared=1&n=' + n, self.registration.scope).href, 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // Gemini API 등 외부 요청은 건드리지 않는다

  // (1) 공유받기 — share_target action(POST multipart/form-data)
  if (req.method === 'POST' && url.pathname.includes('/field-studio')) {
    e.respondWith(
      receiveShare(req).catch(() => Response.redirect(new URL('./?shared=0', self.registration.scope).href, 303))
    );
    return;
  }

  // (2) 앱이 공유받은 사진을 꺼내 가는 통로
  if (url.pathname.includes('/__share__/')) {
    e.respondWith((async () => {
      const c = await caches.open(SHARE);
      const hit = await c.match(url.href);
      if (hit) return hit;
      const emptyMeta = url.pathname.endsWith('/__share__/meta');
      return new Response(JSON.stringify({ ok: false, count: 0 }), {
        status: emptyMeta ? 200 : 404,
        headers: { 'Content-Type': 'application/json' }
      });
    })());
    return;
  }

  if (req.method !== 'GET') return;
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
