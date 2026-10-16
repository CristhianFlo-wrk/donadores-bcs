import { query, transaccion } from '../../config/database.js';
import { errorValidacion, errorNoEncontrado, ErrorHttp } from '../../utils/errores.js';
import { buscarCompatibles, DIAS_ENTRE_DONACIONES } from '../donantes/donantes.service.js';
import { obtenerSolicitudBase, verificarAccesoHospital } from '../solicitudes/solicitudes.service.js';
import { registrarEntrada, registrarLog } from '../auditoria/auditoria.service.js';
import { enviarPushSimulado, enviarSmsSimulado } from './proveedores/console.provider.js';
import { enviarPushReal } from './proveedores/firebase.provider.js';

const RESPUESTAS = ['confirmada', 'rechazada'];

async function enviarPush(donante, titulo, mensaje, datos) {
  if (process.env.FIREBASE_PROJECT_ID && donante.fcm_token) {
    const envio = await enviarPushReal(donante.fcm_token, titulo, mensaje, datos);
    if (envio.ok) return envio;
    console.error('[WARN] Push real fallo para donante ' + donante.id_donante + ', se usa simulado: ' + envio.error);
  }
  return enviarPushSimulado('donante_' + donante.id_donante, mensaje);
}

export function regionDeBusqueda(solicitud, opciones = {}) {
  if (opciones.region) return opciones.region;
  if (opciones.todasLasRegiones || solicitud.urgencia === 'critica') return null;
  return solicitud.hospital_region;
}

// Notifica a los donantes compatibles y aptos. Urgente: region del hospital; critica: todo el estado
export async function notificarSolicitud(usuario, idSolicitud, opciones = {}, contexto = {}) {
  const solicitud = await obtenerSolicitudBase(idSolicitud);
  verificarAccesoHospital(usuario, solicitud.id_hospital);

  if (solicitud.estado !== 'activa') {
    throw errorValidacion('La solicitud no esta activa');
  }

  const region = regionDeBusqueda(solicitud, opciones);
  const candidatos = await buscarCompatibles(solicitud.id_tipo_sangre, {
    region,
    soloDisponibles: true,
    soloAptos: true,
    limite: opciones.limite || 20
  });

  const alcance = region || 'todas';

  if (candidatos.length === 0) {
    return { id_solicitud: idSolicitud, alcance, total_candidatos: 0, notificaciones_enviadas: 0, notificaciones: [] };
  }

  //un donante ya notificado para esta solicitud no se vuelve a notificar
  const nuevas = await transaccion(async (client) => {
    const { rows } = await client.query(`
      INSERT INTO notificaciones (id_solicitud, id_donante, canal, estado)
      SELECT $1, id_donante, 'push', 'enviada' FROM UNNEST($2::int[]) AS id_donante
      ON CONFLICT (id_solicitud, id_donante) DO NOTHING
      RETURNING id, id_donante
    `, [idSolicitud, candidatos.map((c) => c.id_donante)]);

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'NOTIFICACIONES_ENVIADAS',
      detalles: { id_solicitud: idSolicitud, total: rows.length, alcance },
      ipOrigen: contexto.ip
    });

    return rows;
  });

  if (nuevas.length === 0) {
    return { id_solicitud: idSolicitud, alcance, total_candidatos: candidatos.length, notificaciones_enviadas: 0, notificaciones: [] };
  }

  const { rows: tokens } = await query(
    'SELECT id AS id_donante, fcm_token FROM donantes WHERE id = ANY($1::int[])',
    [nuevas.map((n) => n.id_donante)]
  );

  // Solo datos minimos urgencia, tipo de sangre y hospital
  const etiqueta = solicitud.urgencia === 'critica' ? 'CRITICA' : 'URGENTE';
  const titulo = `[${etiqueta}] Se necesita sangre ${solicitud.tipo_sangre}`;
  const mensaje = `${titulo} en ${solicitud.hospital_nombre}. Confirma tu asistencia en la app.`;

  const notificaciones = [];
  for (const nueva of nuevas) {
    const donante = tokens.find((t) => t.id_donante === nueva.id_donante);
    const datos = { id_notificacion: String(nueva.id), id_solicitud: String(idSolicitud) };
    const envio = await enviarPush(donante, titulo, mensaje, datos);
    // El SMS siempre es simulado; el destinatario se identifica por id para no imprimir el telefono en logs
    const sms = await enviarSmsSimulado('donante_' + nueva.id_donante, mensaje);
    notificaciones.push({
      id: nueva.id,
      id_donante: nueva.id_donante,
      canal: 'push',
      estado: 'enviada',
      modo: envio.modo,
      sms: sms.modo
    });
  }

  console.log('[NOTIFICACIONES] Solicitud id=' + idSolicitud + ': ' + notificaciones.length + ' notificaciones enviadas, alcance=' + alcance);

  return {
    id_solicitud: idSolicitud,
    alcance,
    total_candidatos: candidatos.length,
    notificaciones_enviadas: notificaciones.length,
    notificaciones
  };
}

// El donante solo puede responder sus propias notificaciones de solicitudes activas
export async function responderNotificacion(idUsuario, idNotificacion, respuesta, contexto = {}) {
  if (!RESPUESTAS.includes(respuesta)) {
    throw errorValidacion('respuesta debe ser "confirmada" o "rechazada"');
  }

  return transaccion(async (client) => {
    // la solicitud no se puede cerrar ni la notificacion marcar como donada a mitad de la respuesta
    const { rows } = await client.query(`
      SELECT n.id, n.estado, n.id_solicitud, s.estado AS solicitud_estado, d.id_usuario
      FROM notificaciones n
      JOIN donantes d ON n.id_donante = d.id
      JOIN solicitudes s ON n.id_solicitud = s.id
      WHERE n.id = $1
      FOR UPDATE OF n, s
    `, [idNotificacion]);

    const notificacion = rows[0];
    // 404 tambien si es de otro donante, para no revelar que existe
    if (!notificacion || notificacion.id_usuario !== idUsuario) {
      throw errorNoEncontrado('Notificacion no encontrada');
    }

    if (notificacion.solicitud_estado !== 'activa') {
      throw errorValidacion('La solicitud ya no esta activa');
    }

    // Se permite cambiar de confirmada a rechazada y viceversa mientras no haya donado
    if (notificacion.estado === 'donada') {
      throw errorValidacion('La notificacion ya esta donada');
    }

    await client.query(`
      UPDATE notificaciones
      SET estado = $1, fecha_respuesta = NOW()
      WHERE id = $2
    `, [respuesta, idNotificacion]);

    await registrarLog(client, {
      idUsuario,
      accion: respuesta === 'confirmada' ? 'ASISTENCIA_CONFIRMADA' : 'ASISTENCIA_RECHAZADA',
      detalles: { id_notificacion: idNotificacion, id_solicitud: notificacion.id_solicitud },
      ipOrigen: contexto.ip
    });

    return { id: idNotificacion, estado: respuesta, id_solicitud: notificacion.id_solicitud };
  });
}

export async function listarNotificacionesDonante(idUsuario) {
  const { rows } = await query(`
    SELECT n.id, n.id_solicitud, n.canal, n.estado,
           n.fecha_envio, n.fecha_respuesta,
           s.urgencia, s.estado AS solicitud_estado,
           h.nombre AS hospital_nombre, h.direccion AS hospital_direccion,
           ts.codigo AS tipo_sangre
    FROM notificaciones n
    JOIN donantes d ON n.id_donante = d.id
    JOIN solicitudes s ON n.id_solicitud = s.id
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE d.id_usuario = $1
    ORDER BY n.fecha_envio DESC
  `, [idUsuario]);
  return rows;
}

// El hospital marca que el donante asistio y dono: escribe en la cadena de historial_donaciones
export async function registrarDonacion(usuario, idNotificacion, contexto = {}) {
  return transaccion(async (client) => {
    // dos peticiones simultaneas no registran la misma donacion dos veces
    const { rows } = await client.query(`
      SELECT n.id, n.estado, n.id_solicitud, n.id_donante,
             s.id_hospital, s.estado AS solicitud_estado, h.region AS hospital_region,
             d.curp_hash, ts.codigo AS tipo_sangre,
             FLOOR(EXTRACT(EPOCH FROM (NOW() - d.ultima_donacion)) / 86400)::int AS dias_desde_ultima
      FROM notificaciones n
      JOIN solicitudes s ON n.id_solicitud = s.id
      JOIN hospitales h ON s.id_hospital = h.id
      JOIN donantes d ON n.id_donante = d.id
      JOIN tipos_sangre ts ON d.id_tipo_sangre = ts.id
      WHERE n.id = $1
      FOR UPDATE OF n, d
    `, [idNotificacion]);

    const notificacion = rows[0];
    if (!notificacion) {
      throw errorNoEncontrado('Notificacion no encontrada');
    }

    verificarAccesoHospital(usuario, notificacion.id_hospital);

    if (notificacion.estado === 'donada') {
      throw errorValidacion('La donacion ya fue registrada');
    }
    if (notificacion.estado !== 'confirmada') {
      throw errorValidacion('Solo se registra la donacion de un donante que confirmo asistencia');
    }
    if (notificacion.solicitud_estado === 'cancelada') {
      throw errorValidacion('La solicitud fue cancelada');
    }

    const dias = notificacion.dias_desde_ultima;
    if (dias !== null && dias < DIAS_ENTRE_DONACIONES) {
      throw new ErrorHttp(409, `El donante dono hace ${dias} dias; minimo ${DIAS_ENTRE_DONACIONES}`);
    }

    const entrada = await registrarEntrada(client, {
      idDonanteHash: notificacion.curp_hash,
      grupoSanguineo: notificacion.tipo_sangre,
      idHospital: notificacion.id_hospital,
      region: notificacion.hospital_region
    });

    await client.query(
      'UPDATE donantes SET ultima_donacion = $1, ha_donado_antes = TRUE WHERE id = $2',
      [entrada.fecha_donacion, notificacion.id_donante]
    );

    await client.query("UPDATE notificaciones SET estado = 'donada' WHERE id = $1", [idNotificacion]);

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'DONACION_REGISTRADA',
      detalles: { id_notificacion: idNotificacion, id_solicitud: notificacion.id_solicitud, id_historial: entrada.id },
      ipOrigen: contexto.ip
    });

    console.log('[NOTIFICACIONES] Donacion registrada para notificacion id=' + idNotificacion);

    return {
      id_notificacion: idNotificacion,
      id_solicitud: notificacion.id_solicitud,
      estado: 'donada',
      historial: {
        id: entrada.id,
        fecha_donacion: entrada.fecha_donacion,
        hash_anterior: entrada.hash_anterior,
        hash_actual: entrada.hash_actual
      }
    };
  });
}
