import {
  crearSolicitud,
  obtenerSolicitudBase,
  obtenerSolicitudPorId,
  listarSolicitudes,
  buscarCandidatos,
  cerrarSolicitud,
  verificarAccesoHospital
} from './solicitudes.service.js';
import { getRegion } from '../../config/regiones.js';
import { parsearId, parsearLimite, errorValidacion, ErrorHttp } from '../../utils/errores.js';
import { contextoDe } from '../auditoria/auditoria.service.js';

function validarRegion(region) {
  if (region && !getRegion(region)) {
    throw errorValidacion('region debe ser norte, centro o sur');
  }
  return region || null;
}

// Un hospital crea solicitudes para su propio hospital (id del token); admin indica id_hospital
export async function postSolicitud(req, res) {
  const body = req.body || {};
  let idHospital;

  if (req.usuario.rol === 'hospital') {
    idHospital = req.usuario.id_hospital;
    if (body.id_hospital !== undefined && Number(body.id_hospital) !== idHospital) {
      throw new ErrorHttp(403, 'Un usuario hospital solo puede crear solicitudes para su hospital');
    }
  } else {
    if (body.id_hospital === undefined) {
      throw errorValidacion('id_hospital es obligatorio');
    }
    idHospital = parsearId(body.id_hospital, 'id_hospital');
  }

  const solicitud = await crearSolicitud(idHospital, body, contextoDe(req));
  res.status(201).json({ ok: true, solicitud });
}

export async function getSolicitudes(req, res) {
  const solicitudes = await listarSolicitudes({
    estado: req.query.estado || null,
    idHospital: req.query.id_hospital ? parsearId(req.query.id_hospital, 'id_hospital') : null,
    region: validarRegion(req.query.region),
    limite: parsearLimite(req.query.limite)
  });
  res.json({ ok: true, total: solicitudes.length, solicitudes });
}

export async function getSolicitud(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const base = await obtenerSolicitudBase(idSolicitud);

  const { rol, id_hospital: idHospital } = req.usuario;
  const incluirNotificaciones = rol === 'admin' || (rol === 'hospital' && idHospital === base.id_hospital);

  const solicitud = await obtenerSolicitudPorId(idSolicitud, { incluirNotificaciones });
  res.json({ ok: true, solicitud });
}

export async function getCandidatos(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const base = await obtenerSolicitudBase(idSolicitud);
  verificarAccesoHospital(req.usuario, base.id_hospital);

  const resultado = await buscarCandidatos(idSolicitud, {
    region: validarRegion(req.query.region),
    limite: parsearLimite(req.query.limite)
  });
  res.json({ ok: true, ...resultado });
}

export async function patchCerrar(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const { estado } = req.body || {};
  if (!estado) {
    throw errorValidacion('Campo "estado" es obligatorio');
  }

  const base = await obtenerSolicitudBase(idSolicitud);
  verificarAccesoHospital(req.usuario, base.id_hospital);

  const solicitud = await cerrarSolicitud(idSolicitud, estado, contextoDe(req));
  res.json({ ok: true, solicitud });
}
