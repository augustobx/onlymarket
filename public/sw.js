// Network-only worker: never cache protected pages, API responses, session data or sales.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(e.request.method==="GET"&&e.request.mode==="navigate")e.respondWith(fetch(e.request).catch(()=>new Response("<!doctype html><html lang='es'><meta name='viewport' content='width=device-width, initial-scale=1'><meta charset='utf-8'><title>OnlyMarket sin conexión</title><body><h1>Sin conexión</h1><p>Reconectá Internet y recargá la página. Las ventas fuera de línea no están habilitadas.</p></body></html>",{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})));});
