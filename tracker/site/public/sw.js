const C='trainer-v2';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.json'])))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname.startsWith('/api/')||e.request.method!=='GET')return;
 e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
