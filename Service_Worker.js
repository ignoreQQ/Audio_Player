const CACHE_NAME = 'lyric-player-v2'; // 每次大更新就改一下這個名字 (v1 -> v2)
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
  // 之後可以把 icon 也加進來
];

// 安裝時強制跳過等待，讓新版 Service Worker 立即生效
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 關鍵！啟動時自動刪除舊版的快取檔案
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
                  .map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
