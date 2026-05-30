// ============================================
// Service Worker - 不要な手袋チェック PWA
// バージョンを更新するとキャッシュが自動更新される
// ============================================
const CACHE_NAME = 'glove-check-v1';

// オフラインで動作させるファイル一覧
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // 外部フォント・Chart.js もキャッシュ
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// ── インストール: 全アセットをキャッシュ ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 外部リソースは失敗してもインストールを続行
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('Cache skip:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── アクティベート: 古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── フェッチ: キャッシュ優先、なければネット ──
self.addEventListener('fetch', event => {
  // chrome-extension等は無視
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      // キャッシュにない場合はネットワークから取得してキャッシュに追加
      return fetch(event.request).then(response => {
        // 有効なレスポンスのみキャッシュ
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // オフライン時にHTMLリクエストが来たらindex.htmlを返す
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
