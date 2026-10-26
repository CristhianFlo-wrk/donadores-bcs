import {
  verificarHistorial,
  obtenerHistorialDonante,
  obtenerHashDonante,
  obtenerHashPorNotificacion,
  obtenerEstado
} from './auditoria.service.js';
import { verificarAccesoHospital } from '../solicitudes/solicitudes.service.js';
import { parsearId } from '../../utils/errores.js';

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

export async function estado(req, res) {
  const resultado = await obtenerEstado();
  res.json({ ok: true, estado: resultado });
}
