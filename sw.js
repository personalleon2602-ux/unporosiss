/* UNPOROSIS — service worker
   Strategjia:
   - faqja kryesore: network-first, cache si fallback (offline)
   - asete statike (img, css, js, ikona): cache-first
   - kërkesat e jashtme (Firebase, Analytics, fonts): kalojnë direkt, pa cache
   Për me publikue version të re: ndrysho CACHE_VERSION. */

var CACHE_VERSION = 'unporosis-v6';
var PRECACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-48.png',
  '/icon-192.png',
  '/icon-512.png',
  '/img/00536e527e05.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(c){
      // shto një nga një që një aset që mungon të mos prishë instalimin
      return Promise.all(PRECACHE.map(function(url){
        return c.add(new Request(url, {cache:'reload'})).catch(function(){ /* injoro */ });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_VERSION; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('message', function(e){
  if(e.data === 'skipWaiting'){ self.skipWaiting(); }
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;   // Firebase / GA / fonts — pa cache
  if(url.pathname.indexOf('/api/') === 0) return;

  // navigim (faqja) — network first
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(res){
        // ruaj vetëm faqen e mirë — një gabim i serverit (p.sh. 503) s'duhet të zërë vendin e kopjes offline
        if(res && res.ok){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(c){ c.put('/index.html', copy); });
          return res;
        }
        return caches.match('/index.html').then(function(hit){ return hit || res; });
      }).catch(function(){
        return caches.match('/index.html').then(function(hit){
          return hit || caches.match('/offline.html');
        });
      })
    );
    return;
  }

  // asete — cache first
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.ok && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        if(req.destination === 'image') return caches.match('/icon-192.png');
        return new Response('', {status: 504, statusText: 'Offline'});
      });
    })
  );
});
