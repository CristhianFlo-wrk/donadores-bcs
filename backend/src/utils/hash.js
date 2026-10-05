import crypto from 'crypto';

export function generarHash(texto) {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

export function generarHashBloque(datos, hashAnterior) {
  const contenido = JSON.stringify(datos) + hashAnterior;
  return generarHash(contenido);
}

export const HASH_GENESIS = '0'.repeat(64);