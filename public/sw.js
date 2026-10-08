// public/sw.js — service worker de la versión web/escritorio.
// Sirve para que la app abra aunque no haya internet: guarda una copia de
// cada archivo que descarga y, si después no hay conexión, usa esa copia.
//
// - Páginas (HTML): primero intenta internet (así siempre se ve la última
//   versión publicada) y, si falla, usa la copia guardada.
// - Archivos de la app (JS, fuentes, imágenes): primero la copia guardada,
//   porque Expo les pone un nombre distinto en cada versión.
//
// Los datos del usuario NO pasan por acá: están en el almacenamiento del
// navegador (localStorage), que el service worker no toca.

// Si alguna vez cambia la forma de guardar, subir el número para empezar de cero.
const CACHE = "tempomanager-v1";

self.addEventListener("install", () => {
  self.skipWaiting(); // la versión nueva del service worker se activa sin esperar
});

self.addEventListener("activate", (event) => {
  // borra los caches de versiones viejas y toma el control de las pestañas abiertas
  event.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const pedido = event.request;
  // solo GET y solo de este mismo sitio (nada de otros dominios)
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;

  if (pedido.mode === "navigate") {
    event.respondWith(primeroInternet(pedido));
  } else {
    event.respondWith(primeroCopia(pedido));
  }
});

async function primeroInternet(pedido) {
  const cache = await caches.open(CACHE);
  try {
    const respuesta = await fetch(pedido);
    if (respuesta.ok) cache.put(pedido, respuesta.clone());
    return respuesta;
  } catch {
    // sin internet: la copia de esa página o, si no la hay, la de inicio
    return (await cache.match(pedido)) || (await cache.match("/")) || Response.error();
  }
}

async function primeroCopia(pedido) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  const respuesta = await fetch(pedido);
  if (respuesta.ok) cache.put(pedido, respuesta.clone());
  return respuesta;
}
