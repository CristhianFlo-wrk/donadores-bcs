import crypto from 'crypto';
import bcrypt from 'bcrypt';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Cifra un texto con AES-256-CBC

export function cifrar(texto) {
  if (!texto) return null;
  const key = Buffer.from(process.env.AES_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let cifrado = cipher.update(texto, 'utf8', 'hex');
  cifrado += cipher.final('hex');
  return iv.toString('hex') + ':' + cifrado;
}

// decifra el texto cifrado
export function descifrar(textoCifrado) {
  if (!textoCifrado) return null;
  const [ivHex, cifrado] = textoCifrado.split(':');
  const key = Buffer.from(process.env.AES_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let descifrado = decipher.update(cifrado, 'hex', 'utf8');
  descifrado += decipher.final('utf8');
  return descifrado;
}


export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

//verifica la contraseña con su hash 
export async function verificarPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export function hashCURP(curp) {
  return crypto.createHash('sha256').update(curp.toUpperCase().trim()).digest('hex');
}