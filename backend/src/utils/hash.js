import crypto from 'crypto';

export const HASH_GENESIS = '0'.repeat(64);

export function generarHash(texto) {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

// HMAC-SHA256 con HASH_KEY: evita que un hash de dato predecible (CURP) se revierta por fuerza bruta
export function generarHmac(texto) {
  if (!process.env.HASH_KEY) {
    throw new Error('HASH_KEY no configurada');
  }
  return crypto.createHmac('sha256', Buffer.from(process.env.HASH_KEY, 'hex')).update(texto).digest('hex');
}

// Formato de normalizacion para hash chains:
// Date -> ISO 8601 UTC con milisegundos, null/undefined -> cadena vacia, resto -> String(valor)
// Asi un mismo registro produce el mismo texto al insertarlo (tipos JS) y al leerlo de PostgreSQL
// (Date, NUMERIC como string, INTEGER como number)
export function normalizarParaHash(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  return String(valor);
}

// Recibe los valores en orden fijo; el orden lo define cada cadena (ver auditoria.service.js)
export function generarHashEntrada(valores, hashAnterior) {
  const contenido = valores.map(normalizarParaHash).join('|') + '|' + hashAnterior;
  return generarHash(contenido);
}
