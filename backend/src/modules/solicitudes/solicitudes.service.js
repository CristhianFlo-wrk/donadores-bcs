import { query, transaccion } from '../../config/database.js';
import { errorValidacion, errorNoEncontrado, ErrorHttp, parsearId } from '../../utils/errores.js';
import { buscarCompatibles } from '../donantes/donantes.service.js';
import { registrarLog } from '../auditoria/auditoria.service.js';

const URGENCIAS = ['critica', 'urgente'];
const ESTADOS = ['activa', 'completada', 'cancelada'];
const ESTADOS_CIERRE = ['completada', 'cancelada'];
const UNIDADES_MAXIMAS = 20;

function parsearUnidades(valor) {
  if (valor === undefined || valor === null) return 1;
  const unidades = Number(valor);
  if (!Number.isInteger(unidades) || unidades < 1 || unidades > UNIDADES_MAXIMAS) {
    throw errorValidacion('unidades_requeridas debe ser un entero entre 1 y ' + UNIDADES_MAXIMAS);
  }
  return unidades;
}

// Admin accede a cualquier hospital; un usuario hospital solo al suyo
export function verificarAccesoHospital(usuario, idHospital) {
  if (usuario.rol === 'admin') return;
  if (usuario.rol === 'hospital' && usuario.id_hospital === idHospital) return;
  throw new ErrorHttp(403, 'Sin permisos sobre las solicitudes de este hospital');
}

export async function crearSolicitud(idHospital, datos, contexto = {}) {
  const { id_tipo_sangre: idTipoSangre, urgencia, descripcion } = datos;

  if (!idTipoSangre || !urgencia) {
    throw errorValidacion('Faltan campos obligatorios: id_tipo_sangre y urgencia');
  }

  if (!URGENCIAS.includes(urgencia)) {
    throw errorValidacion('urgencia debe ser "critica" o "urgente"');
  }

  parsearId(idTipoSangre, 'id_tipo_sangre');
  const unidadesRequeridas = parsearUnidades(datos.unidades_requeridas);

  const hospital = await query('SELECT id FROM hospitales WHERE id = $1 AND activo = TRUE', [idHospital]);
  if (hospital.rows.length === 0) {
    throw errorValidacion('Hospital no encontrado o inactivo');
  }

  const tipo = await query('SELECT id FROM tipos_sangre WHERE id = $1', [idTipoSangre]);
  if (tipo.rows.length === 0) {
    throw errorValidacion('Tipo de sangre invalido');
  }

  const idSolicitud = await transaccion(async (client) => {
    const { rows } = await client.query(`
      INSERT INTO solicitudes (id_hospital, id_tipo_sangre, urgencia, unidades_requeridas, descripcion, estado)
      VALUES ($1, $2, $3, $4, $5, 'activa')
      RETURNING id
    `, [idHospital, idTipoSangre, urgencia, unidadesRequeridas, descripcion ? String(descripcion).trim() : null]);

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'SOLICITUD_CREADA',
      detalles: {
        id_solicitud: rows[0].id,
        id_hospital: idHospital,
        id_tipo_sangre: Number(idTipoSangre),
        urgencia,
        unidades_requeridas: unidadesRequeridas
      },
      ipOrigen: contexto.ip
    });

    return rows[0].id;
  });

  console.log('[SOLICITUDES] Solicitud creada id=' + idSolicitud + ' hospital=' + idHospital);

  return obtenerSolicitudPorId(idSolicitud, { incluirNotificaciones: true });
}

// Datos basicos de la solicitud sin detalle; lanza 404 si no existe
export async function obtenerSolicitudBase(idSolicitud) {
  const { rows } = await query(`
    SELECT s.*, h.nombre AS hospital_nombre, h.institucion, h.region AS hospital_region,
           ts.codigo AS tipo_sangre
    FROM solicitudes s
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE s.id = $1
  `, [idSolicitud]);

  if (rows.length === 0) {
    throw errorNoEncontrado('Solicitud no encontrada');
  }
  return rows[0];
}

// incluirNotificaciones: solo para el hospital dueno y admin
export async function obtenerSolicitudPorId(idSolicitud, { incluirNotificaciones = false } = {}) {
  const solicitud = await obtenerSolicitudBase(idSolicitud);

  const { rows: metricas } = await query(`
    SELECT COUNT(*) AS total_notificados,
           COUNT(*) FILTER (WHERE estado = 'confirmada') AS confirmaciones,
           COUNT(*) FILTER (WHERE estado = 'enviada') AS pendientes,
           COUNT(*) FILTER (WHERE estado = 'rechazada') AS rechazadas,
           COUNT(*) FILTER (WHERE estado = 'donada') AS donaciones
    FROM notificaciones
    WHERE id_solicitud = $1
  `, [idSolicitud]);

  const resultado = {
    id: solicitud.id,
    hospital: {
      id: solicitud.id_hospital,
      nombre: solicitud.hospital_nombre,
      institucion: solicitud.institucion,
      region: solicitud.hospital_region
    },
    id_tipo_sangre: solicitud.id_tipo_sangre,
    tipo_sangre: solicitud.tipo_sangre,
    urgencia: solicitud.urgencia,
    estado: solicitud.estado,
    unidades_requeridas: solicitud.unidades_requeridas,
    descripcion: solicitud.descripcion,
    fecha_solicitud: solicitud.fecha_solicitud,
    fecha_cierre: solicitud.fecha_cierre,
    metricas: metricas[0]
  };

  if (incluirNotificaciones) {
    const { rows: notificaciones } = await query(`
      SELECT id, id_donante, canal, estado, fecha_envio, fecha_respuesta
      FROM notificaciones
      WHERE id_solicitud = $1
      ORDER BY fecha_envio DESC
    `, [idSolicitud]);
    resultado.notificaciones = notificaciones;
  }

  return resultado;
}

export async function listarSolicitudes(filtros = {}) {
  const { estado, idHospital, region, limite = 50 } = filtros;

  if (estado && !ESTADOS.includes(estado)) {
    throw errorValidacion('estado debe ser activa, completada o cancelada');
  }

  const valores = [];
  let sql = `
    SELECT s.id, s.urgencia, s.estado, s.fecha_solicitud, s.id_hospital,
           s.unidades_requeridas,
           (SELECT COUNT(*) FROM notificaciones n WHERE n.id_solicitud = s.id AND n.estado = 'donada') AS unidades_donadas,
           h.nombre AS hospital_nombre,
           h.region AS region,
           ts.codigo AS tipo_sangre
    FROM solicitudes s
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE TRUE
  `;

  if (estado) {
    valores.push(estado);
    sql += ` AND s.estado = $${valores.length}`;
  }

  if (idHospital) {
    valores.push(idHospital);
    sql += ` AND s.id_hospital = $${valores.length}`;
  }

  if (region) {
    valores.push(region);
    sql += ` AND h.region = $${valores.length}`;
  }

  valores.push(limite);
  sql += ` ORDER BY (s.urgencia = 'critica') DESC, s.fecha_solicitud DESC LIMIT $${valores.length}`;

  const { rows } = await query(sql, valores);
  return rows;
}

export async function buscarCandidatos(idSolicitud, filtros = {}) {
  const solicitud = await obtenerSolicitudBase(idSolicitud);

  if (solicitud.estado !== 'activa') {
    throw errorValidacion('La solicitud no esta activa');
  }

  const candidatos = await buscarCompatibles(solicitud.id_tipo_sangre, {
    region: filtros.region || null,
    limite: filtros.limite || 50
  });

  return {
    id_solicitud: solicitud.id,
    hospital_region: solicitud.hospital_region,
    tipo_sangre_requerido: solicitud.tipo_sangre,
    total_candidatos: candidatos.length,
    candidatos
  };
}

export async function cerrarSolicitud(idSolicitud, nuevoEstado, contexto = {}) {
  if (!ESTADOS_CIERRE.includes(nuevoEstado)) {
    throw errorValidacion('estado debe ser "completada" o "cancelada"');
  }

  // El WHERE estado = 'activa' evita cerrar dos veces si llegan dos peticiones simultaneas
  const cerrada = await transaccion(async (client) => {
    const { rowCount } = await client.query(`
      UPDATE solicitudes
      SET estado = $1, fecha_cierre = NOW()
      WHERE id = $2 AND estado = 'activa'
    `, [nuevoEstado, idSolicitud]);

    if (rowCount === 0) return false;

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'SOLICITUD_CERRADA',
      detalles: { id_solicitud: idSolicitud, estado: nuevoEstado },
      ipOrigen: contexto.ip
    });
    return true;
  });

  if (!cerrada) {
    const solicitud = await obtenerSolicitudBase(idSolicitud);
    throw errorValidacion('La solicitud ya esta ' + solicitud.estado);
  }

  console.log('[SOLICITUDES] Solicitud id=' + idSolicitud + ' cerrada como ' + nuevoEstado);

  return obtenerSolicitudPorId(idSolicitud, { incluirNotificaciones: true });
}
