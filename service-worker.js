// ============================================
// Service Worker - 不要な手袋チェック PWA
// 起動時に裏でサーバーを確認し、更新があれば
// 次回起動時に自動で新バージョンに切り替わる
// ============================================
const CACHE_NAME = 'glove-check-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// ── インストール: 全アセットをキャッシュ ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('Cache skip:', url, err))
        )
      )
    ).then(() => self.skipWaiting())  // 即座に有効化
  );
});

// ── アクティベート: 古いキャッシュを削除 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('Old cache deleted:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())  // 開いているタブをすぐ制御下に
  );
});

// ── フェッチ: キャッシュ優先 ＋ バックグラウンド更新 ──
// 「Stale While Revalidate」戦略:
//   1. まずキャッシュを即座に返す（速い・オフラインOK）
//   2. 裏でネットワークからも取得してキャッシュを更新
//   3. 次回起動時には新しいキャッシュが使われる
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;

  // GETリクエストのみキャッシュ戦略を適用
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {

        // ── バックグラウンドでネットワーク取得（更新チェック）──
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            // 有効なレスポンスをキャッシュに保存（次回から新版を使う）
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => null); // オフラインでも無視

        // キャッシュがあれば即返す（裏でネットワーク更新は続く）
        if (cached) return cached;

        // キャッシュがなければネットワーク取得を待つ
        return networkFetch.then(response => {
          if (response) return response;
          // オフライン時はindex.htmlにフォールバック
          if (event.request.destination === 'document') {
            return cache.match('./index.html');
          }
        });
      })
    )
  );
});

// ── メッセージ受信: アプリ側からの手動更新指示 ──
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
