/* 2026 학교폭력 실전 플레이북 — Service Worker (Network-First, ?v=3)
 * 네트워크가 되면 최신을 받고, 실패하면 캐시로 연다. 오프라인에서도 앱·데이터가 그대로 뜬다.
 */
var VERSION = 'hakpok-playbook-v3';
var CACHE = VERSION;
var CORE = [
  './',
  './index.html',
  './index.html?v=3',
  './css/app.css?v=3',
  './js/tree.js?v=3',
  './js/stagedata.js?v=3',
  './js/app.js?v=3',
  './data/official_2026.json?v=3',
  './data/cases_public.json?v=3',
  './data/cases_oneline.json?v=3',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CORE.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () { /* 개별 실패는 무시 */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf('hakpok-playbook-') === 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        return caches.match(req, { ignoreSearch: true }).then(function (hit2) {
          if (hit2) return hit2;
          if (req.mode === 'navigate') {
            return caches.match('./index.html').then(function (idx) {
              return idx || new Response('<h1>오프라인</h1><p>한 번 online 상태로 열어 두면 이 앱은 오프라인에서도 열립니다.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            });
          }
          return new Response('', { status: 504, statusText: 'offline' });
        });
      });
    })
  );
});
