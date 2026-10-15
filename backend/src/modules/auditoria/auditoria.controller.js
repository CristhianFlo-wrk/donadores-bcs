import {
  verificarHistorial,
  obtenerHistorialDonante,
  obtenerHashDonante,
  obtenerEstado
} from './auditoria.service.js';
import { errorValidacion } from '../../utils/errores.js';

const REGEX_HASH = /^[0-9a-f]{64}$/;

function validarHash(hash) {
  if (!REGEX_HASH.test(hash)) {
    throw errorValidacion('hashDonante debe ser un hash SHA-256 en hex (64 caracteres)');
  }
  return hash;
}

// Historial del propio donante sin exponer su hash en la URL
export async function miHistorial(req, res) {
  const hash = await obtenerHashDonante(req.usuario.id);
  const [entradas, verificacion] = await Promise.all([obtenerHistorialDonante(hash), verificarHistorial(hash)]);
  res.json({ ok: true, total: entradas.length, verificacion, entradas });
}

export async function verificar(req, res) {
  const verificacion = await verificarHistorial(validarHash(req.params.hashDonante));
  res.json({ ok: true, verificacion });
}

export async function historial(req, res) {
  const entradas = await obtenerHistorialDonante(validarHash(req.params.hashDonante));
  res.json({ ok: true, total: entradas.length, entradas });
}

export async function estado(req, res) {
  const resultado = await obtenerEstado();
  res.json({ ok: true, estado: resultado });
}
