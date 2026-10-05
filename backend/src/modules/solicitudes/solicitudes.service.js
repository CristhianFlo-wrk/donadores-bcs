import { buscarCompatibles } from '../donantes/donantes.service.js';

export function crearSolicitud(db, idHospital, datos) {
  const { id_tipo_sangre, urgencia, descripcion } = datos;

  if (!idHospital || !id_tipo_sangre || !urgencia) {
    throw new Error('Faltan campos obligatorios: hospital, tipo de sangre y urgencia');
  }

  if (!['critica', 'urgente'].includes(urgencia)) {
    throw new Error('Urgencia debe ser "critica" o "urgente"');
  }

  const hospital = db.prepare(
    'SELECT id, id_nodo FROM hospitales WHERE id = ? AND activo = 1'
  ).get(idHospital);

  if (!hospital) {
    throw new Error('Hospital no encontrado o inactivo');
  }

  const tipoSangre = db.prepare(
    'SELECT id, codigo FROM tipos_sangre WHERE id = ?'
  ).get(id_tipo_sangre);

  if (!tipoSangre) {
    throw new Error('Tipo de sangre inválido');
  }

  const result = db.prepare(`
    INSERT INTO solicitudes (id_hospital, id_tipo_sangre, urgencia, descripcion, estado)
    VALUES (?, ?, ?, ?, 'activa')
  `).run(idHospital, id_tipo_sangre, urgencia, descripcion || null);

  return obtenerSolicitudPorId(db, result.lastInsertRowid);
}

export function obtenerSolicitudPorId(db, idSolicitud) {
  const solicitud = db.prepare(`
    SELECT s.*, 
           h.nombre as hospital_nombre,
           h.institucion,
           h.id_nodo as hospital_nodo,
           ts.codigo as tipo_sangre,
           ts.grupo, ts.rh
    FROM solicitudes s
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE s.id = ?
  `).get(idSolicitud);

  if (!solicitud) return null;

  const notificaciones = db.prepare(`
    SELECT n.*, d.curp_hash
    FROM notificaciones n
    JOIN donantes d ON n.id_donante = d.id
    WHERE n.id_solicitud = ?
    ORDER BY n.fecha_envio DESC
  `).all(idSolicitud);

  const confirmaciones = notificaciones.filter(n => n.estado === 'confirmada').length;
  const pendientes = notificaciones.filter(n => n.estado === 'enviada').length;

  return {
    id: solicitud.id,
    hospital: {
      id: solicitud.id_hospital,
      nombre: solicitud.hospital_nombre,
      institucion: solicitud.institucion,
      id_nodo: solicitud.hospital_nodo
    },
    tipo_sangre: solicitud.tipo_sangre,
    urgencia: solicitud.urgencia,
    estado: solicitud.estado,
    descripcion: solicitud.descripcion,
    fecha_solicitud: solicitud.fecha_solicitud,
    fecha_cierre: solicitud.fecha_cierre,
    metricas: {
      total_notificados: notificaciones.length,
      confirmaciones,
      pendientes,
      rechazadas: notificaciones.length - confirmaciones - pendientes
    },
    notificaciones: notificaciones.map(n => ({
      id: n.id,
      donante_hash: n.curp_hash.substring(0, 16) + '...',
      canal: n.canal,
      estado: n.estado,
      fecha_envio: n.fecha_envio,
      fecha_respuesta: n.fecha_respuesta
    }))
  };
}

export function listarSolicitudes(db, filtros = {}) {
  const { estado, id_hospital, id_nodo, limite = 50 } = filtros;

  let query = `
    SELECT s.id, s.urgencia, s.estado, s.fecha_solicitud,
           h.nombre as hospital_nombre,
           h.id_nodo as hospital_nodo,
           ts.codigo as tipo_sangre
    FROM solicitudes s
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE 1=1
  `;

  const valores = [];

  if (estado) {
    query += ' AND s.estado = ?';
    valores.push(estado);
  }

  if (id_hospital) {
    query += ' AND s.id_hospital = ?';
    valores.push(id_hospital);
  }

  if (id_nodo) {
    query += ' AND h.id_nodo = ?';
    valores.push(id_nodo);
  }

  query += ' ORDER BY s.fecha_solicitud DESC LIMIT ?';
  valores.push(limite);

  const solicitudes = db.prepare(query).all(...valores);

  return solicitudes.map(s => ({
    id: s.id,
    hospital: s.hospital_nombre,
    id_nodo: s.hospital_nodo,
    tipo_sangre: s.tipo_sangre,
    urgencia: s.urgencia,
    estado: s.estado,
    fecha_solicitud: s.fecha_solicitud
  }));
}

export function buscarCandidatos(db, idSolicitud, filtros = {}) {
  const solicitud = db.prepare(`
    SELECT s.id, s.id_hospital, s.id_tipo_sangre, s.estado,
           h.id_nodo as hospital_nodo
    FROM solicitudes s
    JOIN hospitales h ON s.id_hospital = h.id
    WHERE s.id = ?
  `).get(idSolicitud);

  if (!solicitud) {
    throw new Error('Solicitud no encontrada');
  }

  if (solicitud.estado !== 'activa') {
    throw new Error('La solicitud no está activa');
  }

  const candidatos = buscarCompatibles(db, solicitud.id_tipo_sangre, {
    idNodo: filtros.idNodo || null,
    soloDisponibles: true,
    limite: filtros.limite || 50
  });

  return {
    solicitud_id: idSolicitud,
    hospital_nodo: solicitud.hospital_nodo,
    tipo_sangre_requerido: solicitud.id_tipo_sangre,
    total_candidatos: candidatos.length,
    candidatos
  };
}

export function cerrarSolicitud(db, idSolicitud, nuevoEstado) {
  if (!['completada', 'cancelada'].includes(nuevoEstado)) {
    throw new Error('Estado debe ser "completada" o "cancelada"');
  }

  const solicitud = db.prepare(
    'SELECT id, estado FROM solicitudes WHERE id = ?'
  ).get(idSolicitud);

  if (!solicitud) {
    throw new Error('Solicitud no encontrada');
  }

  if (solicitud.estado !== 'activa') {
    throw new Error(`La solicitud ya está ${solicitud.estado}`);
  }

  db.prepare(`
    UPDATE solicitudes 
    SET estado = ?, fecha_cierre = ?
    WHERE id = ?
  `).run(nuevoEstado, new Date().toISOString(), idSolicitud);

  return obtenerSolicitudPorId(db, idSolicitud);
}