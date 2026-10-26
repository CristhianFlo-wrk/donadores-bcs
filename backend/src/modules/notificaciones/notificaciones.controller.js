import {
  notificarSolicitud,
  responderNotificacion,
  listarNotificacionesDonante,
  listarConfirmadasHospital,
  registrarDonacion
} from './notificaciones.service.js';
import { getRegion } from '../../config/regiones.js';
import { parsearId, parsearLimite, errorValidacion } from '../../utils/errores.js';
import { contextoDe } from '../auditoria/auditoria.service.js';

export async function postNotificar(req, res) {
  const { id_solicitud: idSolicitud, region, todas_las_regiones: todasLasRegiones, limite } = req.body || {};

  if (idSolicitud === undefined) {
    throw errorValidacion('id_solicitud es obligatorio');
  }
  if (region && !getRegion(region)) {
    throw errorValidacion('region debe ser norte, centro o sur');
  }

  const resultado = await notificarSolicitud(req.usuario, parsearId(idSolicitud, 'id_solicitud'), {
    region: region || null,
    todasLasRegiones: todasLasRegiones === true,
    limite: parsearLimite(limite, { defecto: 20, maximo: 100 })
  }, contextoDe(req));
  res.json({ ok: true, ...resultado });
}

export async function patchResponder(req, res) {
  const { respuesta } = req.body || {};
  if (!respuesta) {
    throw errorValidacion('Campo "respuesta" es obligatorio');
  }

  const notificacion = await responderNotificacion(req.usuario.id, parsearId(req.params.id), respuesta, contextoDe(req));
  res.json({ ok: true, notificacion });
}

export async function getMisNotificaciones(req, res) {
  const notificaciones = await listarNotificacionesDonante(req.usuario.id);
  res.json({ ok: true, total: notificaciones.length, notificaciones });
}

export async function getConfirmadas(req, res) {
  const notificaciones = await listarConfirmadasHospital(req.usuario.id_hospital);
  res.json({ ok: true, total: notificaciones.length, notificaciones });
}

export async function patchDonacion(req, res) {
  const donacion = await registrarDonacion(req.usuario, parsearId(req.params.id), contextoDe(req));
  res.json({ ok: true, donacion });
}
