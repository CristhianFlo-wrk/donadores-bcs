import {
  obtenerPerfil,
  actualizarPerfil,
  cambiarDisponibilidad,
  obtenerStats,
  actualizarFcmToken
} from './donantes.service.js';
import { errorValidacion } from '../../utils/errores.js';
import { contextoDe } from '../auditoria/auditoria.service.js';

export async function getPerfil(req, res) {
  const perfil = await obtenerPerfil(req.usuario.id);
  res.json({ ok: true, perfil });
}

export async function putPerfil(req, res) {
  const perfil = await actualizarPerfil(req.usuario.id, req.body || {}, contextoDe(req));
  res.json({ ok: true, perfil });
}

export async function patchDisponibilidad(req, res) {
  const { disponible } = req.body || {};
  if (typeof disponible !== 'boolean') {
    throw errorValidacion('Campo "disponible" debe ser boolean');
  }
  const resultado = await cambiarDisponibilidad(req.usuario.id, disponible, contextoDe(req));
  res.json({ ok: true, ...resultado });
}

export async function putFcmToken(req, res) {
  const body = req.body || {};
  if (body.fcm_token === undefined) {
    throw errorValidacion('Campo "fcm_token" es obligatorio (null para desactivar)');
  }
  const resultado = await actualizarFcmToken(req.usuario.id, body.fcm_token);
  res.json({ ok: true, ...resultado });
}

export async function getStats(req, res) {
  const stats = await obtenerStats(req.usuario.id);
  res.json({ ok: true, stats });
}
