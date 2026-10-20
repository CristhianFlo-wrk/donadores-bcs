import { useEffect, useState } from 'react';


let eventoInstalacion = null;
const suscriptores = new Set();

function avisar() {
  suscriptores.forEach((funcion) => funcion(eventoInstalacion));
}

export function iniciarPwa() {
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    eventoInstalacion = evento;
    avisar();
  });

  window.addEventListener('appinstalled', () => {
    eventoInstalacion = null;
    avisar();
  });

  // En desarrollo no se registra para que la cache no oculte los cambios
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('[PWA] No se pudo registrar el service worker: ' + error.message);
      });
    });
  }
}

export function esAppInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function esIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function useInstalacion() {
  const [evento, setEvento] = useState(eventoInstalacion);

  useEffect(() => {
    suscriptores.add(setEvento);
    return () => suscriptores.delete(setEvento);
  }, []);

  async function instalar() {
    if (!evento) return;
    evento.prompt();
    await evento.userChoice;
    eventoInstalacion = null;
    avisar();
  }

  return { disponible: Boolean(evento), instalar };
}

export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  useEffect(() => {
    const conectado = () => setEnLinea(true);
    const desconectado = () => setEnLinea(false);
    window.addEventListener('online', conectado);
    window.addEventListener('offline', desconectado);
    return () => {
      window.removeEventListener('online', conectado);
      window.removeEventListener('offline', desconectado);
    };
  }, []);

  return enLinea;
}
