import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { generarHmac } from './hash.js';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function obtenerClaveAes() {
  const clave = Buffer.from(process.env.AES_KEY || '', 'hex');
  if (clave.length !== 32) {
    throw new Error('AES_KEY debe ser de 32 bytes en hex (64 caracteres)');
  }
  return clave;
}

// Cifra un texto con AES-256-CBC. Formato de salida: ivHex:cifradoHex
export function cifrar(texto) {
  if (texto === null || texto === undefined || texto === '') return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, obtenerClaveAes(), iv);
  let cifrado = cipher.update(String(texto), 'utf8', 'hex');
  cifrado += cipher.final('hex');
  return iv.toString('hex') + ':' + cifrado;
}

// Descifra el texto cifrado
export function descifrar(textoCifrado) {
  if (!textoCifrado) return null;
  const [ivHex, cifrado] = textoCifrado.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, obtenerClaveAes(), Buffer.from(ivHex, 'hex'));
  let descifrado = decipher.update(cifrado, 'hex', 'utf8');
  descifrado += decipher.final('utf8');
  return descifrado;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Verifica la contrasena con su hash
export async function verificarPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function normalizarCURP(curp) {
  return String(curp).toUpperCase().trim();
}

export function hashCURP(curp) {
  return generarHmac(normalizarCURP(curp));
}
