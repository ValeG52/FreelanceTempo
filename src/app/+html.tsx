// src/app/+html.tsx — esqueleto HTML de la versión web/escritorio.
// Solo se usa en web: en el celular este archivo se ignora. Enlaza el
// manifest (lo que permite "instalar" la app desde Chrome/Edge) y registra
// el service worker (para que abra sin internet).
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Script que registra public/sw.js. Solo en la versión publicada: con
// "npx expo start" un service worker guardaría copias viejas y confundiría.
const registrarServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('No se pudo registrar el service worker:', error);
    });
  });
}
`;

/** Esqueleto de cada página web. "children" es la app que arma Expo Router. */
export default function Root({ children }: PropsWithChildren) {
  const esProduccion = process.env.NODE_ENV === "production";

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Tempomanager</title>
        <meta name="description" content="Agenda de paquetes de horas por empresa" />
        <meta name="theme-color" content="#FFD23F" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* quita el scroll de la página entera: cada pantalla tiene su propio scroll */}
        <ScrollViewStyleReset />
        {/* mismo fondo que la app, para que no se vea un destello blanco al abrir */}
        <style dangerouslySetInnerHTML={{ __html: "body { background-color: #F4F1EA; }" }} />
        {esProduccion && <script dangerouslySetInnerHTML={{ __html: registrarServiceWorker }} />}
      </head>
      <body>{children}</body>
    </html>
  );
}
