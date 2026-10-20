// los datos de la API nunca se guardan en cache 
const VERSION = 'donadores-v1';
const PRECARGA = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/iconos/icono-192.png',
  '/iconos/icono-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECARGA)));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);

  // Solo GET del mismo origen y la API va directo a la red
  if (peticion.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put('/index.html', copia));
          return respuesta;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Archivos estaticos (JS, CSS, fuentes, iconos)
  evento.respondWith(
    caches.match(peticion).then((guardada) => {
      if (guardada) return guardada;
      return fetch(peticion).then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      });
    })
  );
});
