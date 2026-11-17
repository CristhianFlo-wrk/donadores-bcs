import {
  notificarSolicitud,
  responderNotificacion,
  ofrecerseSolicitud,
  listarNotificacionesDonante,
  listarConfirmadasHospital,
  registrarDonacion
} from './notificaciones.service.js';
import { validarRegion } from '../../config/regiones.js';
import { parsearId, parsearLimite, errorValidacion } from '../../utils/errores.js';
import { contextoDe } from '../auditoria/auditoria.service.js';

export async function postNotificar(req, res) {
  const { id_solicitud: idSolicitud, region, todas_las_regiones: todasLasRegiones, limite } = req.body || {};

  if (idSolicitud === undefined) {
    throw errorValidacion('id_solicitud es obligatorio');
  }
  const resultado = await notificarSolicitud(req.usuario, parsearId(idSolicitud, 'id_solicitud'), {
    region: validarRegion(region),
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

export async function postOfrecerme(req, res) {
  const { id_solicitud: idSolicitud } = req.body || {};
  if (idSolicitud === undefined) {
    throw errorValidacion('id_solicitud es obligatorio');
  }

  const notificacion = await ofrecerseSolicitud(req.usuario.id, parsearId(idSolicitud, 'id_solicitud'), contextoDe(req));
  res.status(notificacion.nueva ? 201 : 200).json({ ok: true, notificacion });
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
  const donacion = await registrarDonacion(req.usuario, parsearId(req.params.id), (req.body || {}).curp, contextoDe(req));
  res.json({ ok: true, donacion });
}
