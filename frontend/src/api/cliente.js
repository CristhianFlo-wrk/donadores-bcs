const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const CLAVE_TOKEN = 'donadores_token';

let alExpirarSesion = null;

export class ErrorApi extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

// localStorage puede fallar en modo privado; la sesion entonces dura lo que la pestana
export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento disponible
  }
}

export function registrarAlExpirarSesion(funcion) {
  alExpirarSesion = funcion;
}

// Envuelve fetch: agrega el token, convierte errores de la API en ErrorApi y cierra sesion con 401
export async function peticion(metodo, ruta, cuerpo) {
  const token = leerToken();
  const cabeceras = {};
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = 'Bearer ' + token;

  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  if (!respuesta.ok || !datos || datos.ok === false) {
    if (respuesta.status === 401 && token && alExpirarSesion) {
      alExpirarSesion();
    }
    if (respuesta.status === 429) {
      const segundos = Number(respuesta.headers.get('Retry-After')) || 900;
      const minutos = Math.ceil(segundos / 60);
      throw new ErrorApi(429, 'Demasiados intentos. Espera ' + minutos + ' minutos antes de volver a intentar.');
    }
    throw new ErrorApi(respuesta.status, datos?.error || 'Error inesperado del servidor');
  }

  return datos;
}

export const api = {
  get: (ruta) => peticion('GET', ruta),
  post: (ruta, cuerpo = {}) => peticion('POST', ruta, cuerpo),
  put: (ruta, cuerpo = {}) => peticion('PUT', ruta, cuerpo),
  patch: (ruta, cuerpo = {}) => peticion('PATCH', ruta, cuerpo)
};
