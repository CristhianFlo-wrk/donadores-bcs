import { buscarCompatibles } from '../donantes/donantes.service.js';
import { enviarPushSimulado } from './proveedores/console.provider.js';

export async function notificarSolicitud(db, idSolicitud, opciones = {}) {
  const solicitud = db.prepare(`
    SELECT s.id, s.id_hospital, s.id_tipo_sangre, s.urgencia, s.estado,
           h.nombre as hospital_nombre, h.id_nodo as hospital_nodo,
           ts.codigo as tipo_sangre
    FROM solicitudes s
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE s.id = ?
  `).get(idSolicitud);

  if (!solicitud) {
    throw new Error('Solicitud no encontrada');
  }

  if (solicitud.estado !== 'activa') {
    throw new Error('La solicitud no está activa');
  }

  const filtrosBusqueda = {
    idNodo: opciones.idNodo || solicitud.hospital_nodo,
    soloDisponibles: true,
    limite: opciones.limite || 20
  };

  const candidatos = buscarCompatibles(db, solicitud.id_tipo_sangre, filtrosBusqueda);

  if (candidatos.length === 0) {
    return {
      solicitud_id: idSolicitud,
      total_candidatos: 0,
      notificaciones_enviadas: 0,
      mensaje: 'No hay donantes compatibles disponibles'
    };
  }

  const urgenciaTexto = solicitud.urgencia === 'critica' ? 'URGENTE' : 'URGENTE';
  const mensaje = `[${urgenciaTexto}] Se requiere sangre ${solicitud.tipo_sangre} en ${solicitud.hospital_nombre}. Confirma tu asistencia en la app.`;

  const notificacionesEnviadas = [];

  for (const candidato of candidatos) {
    const yaNotificado = db.prepare(`
      SELECT id FROM notificaciones
      WHERE id_solicitud = ? AND id_donante = ?
    `).get(idSolicitud, candidato.id);

    if (yaNotificado) continue;

    const result = db.prepare(`
      INSERT INTO notificaciones (id_solicitud, id_donante, canal, estado)
      VALUES (?, ?, 'push', 'enviada')
    `).run(idSolicitud, candidato.id);

    const envio = await enviarPushSimulado(
      `donante_${candidato.id}`,
      mensaje
    );

    notificacionesEnviadas.push({
      id: result.lastInsertRowid,
      id_donante: candidato.id,
      canal: 'push',
      estado: 'enviada',
      modo: envio.modo
    });
  }

  return {
    solicitud_id: idSolicitud,
    total_candidatos: candidatos.length,
    notificaciones_enviadas: notificacionesEnviadas.length,
    notificaciones: notificacionesEnviadas
  };
}

export function responderNotificacion(db, idNotificacion, respuesta) {
  if (!['confirmada', 'rechazada'].includes(respuesta)) {
    throw new Error('Respuesta debe ser "confirmada" o "rechazada"');
  }

  const notificacion = db.prepare(`
    SELECT n.*, d.curp_hash
    FROM notificaciones n
    JOIN donantes d ON n.id_donante = d.id
    WHERE n.id = ?
  `).get(idNotificacion);

  if (!notificacion) {
    throw new Error('Notificación no encontrada');
  }

  if (notificacion.estado !== 'enviada') {
    throw new Error(`La notificación ya está ${notificacion.estado}`);
  }

  db.prepare(`
    UPDATE notificaciones
    SET estado = ?, fecha_respuesta = ?
    WHERE id = ?
  `).run(respuesta, new Date().toISOString(), idNotificacion);

  return {
    id: idNotificacion,
    estado: respuesta,
    solicitud_id: notificacion.id_solicitud
  };
}

export function listarNotificacionesDonante(db, idUsuario) {
  const donante = db.prepare(
    'SELECT id FROM donantes WHERE id_usuario = ?'
  ).get(idUsuario);

  if (!donante) throw new Error('Donante no encontrado');

  const notificaciones = db.prepare(`
    SELECT n.id, n.id_solicitud, n.canal, n.estado,
           n.fecha_envio, n.fecha_respuesta,
           s.urgencia, s.estado as solicitud_estado,
           h.nombre as hospital_nombre,
           ts.codigo as tipo_sangre
    FROM notificaciones n
    JOIN solicitudes s ON n.id_solicitud = s.id
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE n.id_donante = ?
    ORDER BY n.fecha_envio DESC
  `).all(donante.id);

  return notificaciones;
}