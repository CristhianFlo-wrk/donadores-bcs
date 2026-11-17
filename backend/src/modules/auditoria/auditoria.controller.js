import {
  verificarHistorial,
  obtenerHistorialDonante,
  obtenerHashDonante,
  obtenerHashPorNotificacion,
  obtenerEstado,
  listarBitacora,
  contextoDe,
  registrarConsultaAuditoria,
  obtenerEslabon,
  emitirConstancia,
  comprobarConstancia
} from './auditoria.service.js';
import { verificarAccesoHospital } from '../solicitudes/solicitudes.service.js';
import { errorValidacion, parsearFecha, parsearId, parsearLimite } from '../../utils/errores.js';
import { validarRegion } from '../../config/regiones.js';

// Historial del propio donante sin exponer su hash en la URL
export async function miHistorial(req, res) {
  const hash = await obtenerHashDonante(req.usuario.id);
  const [entradas, verificacion] = await Promise.all([obtenerHistorialDonante(hash), verificarHistorial(hash)]);
  res.json({ ok: true, total: entradas.length, verificacion, entradas });
}

//El hospital dueno de la solicitud (o admin) verifica el historial del donante notificado
export async function historialPorNotificacion(req, res) {
  const idNotificacion = parsearId(req.params.idNotificacion, 'idNotificacion');
  const { hash, idHospital } = await obtenerHashPorNotificacion(idNotificacion);
  verificarAccesoHospital(req.usuario, idHospital);

  const [entradas, verificacion] = await Promise.all([obtenerHistorialDonante(hash), verificarHistorial(hash)]);
  res.json({ ok: true, id_notificacion: idNotificacion, total: entradas.length, verificacion, entradas });
}

// La consulta queda en la bitacora (una por usuario cada 10 minutos): se sabe quien reviso la auditoria y cuando
export async function estado(req, res) {
  const resultado = await obtenerEstado({ completa: req.query.completa === 'true' });
  await registrarConsultaAuditoria(contextoDe(req));
  res.json({ ok: true, estado: resultado });
}

export async function eslabon(req, res) {
  const resultado = await obtenerEslabon(parsearId(req.params.id));
  res.json({ ok: true, eslabon: resultado });
}

export async function postConstancia(req, res) {
  const constancia = await emitirConstancia(contextoDe(req));
  res.status(201).json({ ok: true, constancia });
}

export async function comprobar(req, res) {
  const body = req.body || {};
  const donaciones = body.donaciones_hasta;
  const donacionesHasta = donaciones === 0 || donaciones === '0' ? 0 : parsearId(donaciones, 'donaciones_hasta');
  const sello = String(body.sello ?? '').replace(/[\s-]/g, '').toLowerCase();
  if (!/^[0-9a-f]{16,64}$/.test(sello)) {
    throw errorValidacion('El sello debe tener al menos los 16 caracteres que aparecen en la constancia');
  }
  const resultado = await comprobarConstancia({ logsHasta: parsearId(body.logs_hasta, 'logs_hasta'), donacionesHasta, sello }, contextoDe(req));
  res.json({ ok: true, comprobacion: resultado });
}

export async function bitacora(req, res) {
  const texto = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null);
  const opcional = (valor, nombre) => (texto(valor) === null ? null : parsearId(valor, nombre));

  const acciones = texto(req.query.accion) ? texto(req.query.accion).split(',').map((a) => a.trim()).filter(Boolean) : null;
  if (acciones && acciones.length > 30) throw errorValidacion('accion admite como maximo 30 valores');

  const desde = parsearFecha(texto(req.query.desde), 'desde');
  const hasta = parsearFecha(texto(req.query.hasta), 'hasta');
  if (desde && hasta && desde > hasta) throw errorValidacion('desde no puede ser posterior a hasta');

  const usuario = texto(req.query.usuario);
  if (usuario && usuario.length > 150) throw errorValidacion('usuario admite como maximo 150 caracteres');

  const { entradas, hayMas } = await listarBitacora({
    limite: parsearLimite(req.query.limite),
    acciones,
    antes: opcional(req.query.antes, 'antes'),
    usuario,
    idHospital: opcional(req.query.id_hospital, 'id_hospital'),
    region: validarRegion(texto(req.query.region)),
    desde,
    hasta,
    idSolicitud: opcional(req.query.id_solicitud, 'id_solicitud')
  });
  res.json({ ok: true, total: entradas.length, hay_mas: hayMas, entradas });
}
