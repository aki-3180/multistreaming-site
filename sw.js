/* MultiView のアプリシェル用 Service Worker

   目的は2つだけ:
   1) ホーム画面に追加した時に「アプリ」として起動できるようにする（インストール可能要件）
   2) 再起動・回線が不安定なときでも即座に画面が立ち上がるようにする

   配信/チャットは全て別オリジンなので一切触らない（キャッシュすると壊れる）。
   同一オリジンのGETのみ、ネットワーク優先＋キャッシュフォールバックで扱う。 */

const CACHE = 'multiview-shell-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {}) // 1つでも失敗するとinstallごと失敗するので握りつぶす
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ネットワーク優先。デプロイ直後に古いapp.jsを掴ませないため。
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
