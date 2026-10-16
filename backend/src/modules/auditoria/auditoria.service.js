import { query, transaccion } from '../../config/database.js';
import { generarHashEntrada, HASH_GENESIS } from '../../utils/hash.js';
import { errorNoEncontrado } from '../../utils/errores.js';

// Llave fija del advisory lock que serializa la cadena global de auditoria_logs
const LOCK_AUDITORIA_LOGS = 7310001;

// Orden fijo de campos que entran al hash de cada cadena. Cambiarlo invalida las cadenas existentes
function valoresHashDonacion(fila) {
  return [fila.id_donante_hash, fila.fecha_donacion, fila.grupo_sanguineo, fila.id_hospital, fila.region];
}

function valoresHashLog(fila) {
  return [fila.id_usuario, fila.accion, jsonCanonico(fila.detalles), fila.ip_origen, fila.fecha];
}

function jsonCanonico(valor) {
  if (valor === null || valor === undefined) return '';
  const ordenar = (v) => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === 'object') {
      return Object.keys(v).sort().reduce((obj, llave) => ({ ...obj, [llave]: ordenar(v[llave]) }), {});
    }
    return v;
  };
  return JSON.stringify(ordenar(valor));
}

async function ahora(client) {
  const { rows } = await client.query("SELECT date_trunc('milliseconds', NOW()) AS ahora");
  return rows[0].ahora;
}

// Datos de quien hace la peticion, para auditoria_logs
export function contextoDe(req) {
  return { idUsuario: req.usuario ? req.usuario.id : null, ip: req.ip || null };
}

export async function registrarEntrada(client, { idDonanteHash, grupoSanguineo, idHospital, region }) {
  // Lock por donante: dos donaciones simultaneas del mismo donante no bifurcan su cadena
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['historial:' + idDonanteHash]);

  const ultimo = await client.query(`
    SELECT hash_actual FROM historial_donaciones
    WHERE id_donante_hash = $1
    ORDER BY id DESC LIMIT 1
  `, [idDonanteHash]);

  const hashAnterior = ultimo.rows.length > 0 ? ultimo.rows[0].hash_actual : HASH_GENESIS;

  const entrada = {
    id_donante_hash: idDonanteHash,
    fecha_donacion: await ahora(client),
    grupo_sanguineo: grupoSanguineo,
    id_hospital: idHospital,
    region
  };
  const hashActual = generarHashEntrada(valoresHashDonacion(entrada), hashAnterior);

  const { rows } = await client.query(`
    INSERT INTO historial_donaciones
    (id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, region, hash_anterior, hash_actual)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [idDonanteHash, entrada.fecha_donacion, grupoSanguineo, idHospital, region, hashAnterior, hashActual]);

  console.log('[AUDITORIA] Entrada de donacion registrada id=' + rows[0].id);

  return { id: rows[0].id, ...entrada, hash_anterior: hashAnterior, hash_actual: hashActual };
}

// Registra una accion en la cadena global. Con client usa la transaccion abierta; sin client abre una propia
export async function registrarLog(client, { idUsuario = null, accion, detalles = null, ipOrigen = null }) {
  if (!client) {
    return transaccion((nuevoClient) => registrarLog(nuevoClient, { idUsuario, accion, detalles, ipOrigen }));
  }

  await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_AUDITORIA_LOGS]);

  const ultimo = await client.query('SELECT hash_actual FROM auditoria_logs ORDER BY id DESC LIMIT 1');
  const hashAnterior = ultimo.rows.length > 0 ? ultimo.rows[0].hash_actual : HASH_GENESIS;

  const log = { id_usuario: idUsuario, accion, detalles, ip_origen: ipOrigen, fecha: await ahora(client) };
  const hashActual = generarHashEntrada(valoresHashLog(log), hashAnterior);

  const { rows } = await client.query(`
    INSERT INTO auditoria_logs (id_usuario, accion, detalles, ip_origen, fecha, hash_anterior, hash_actual)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [idUsuario, accion, detalles === null ? null : JSON.stringify(detalles), ipOrigen, log.fecha, hashAnterior, hashActual]);

  return { id: rows[0].id, hash_actual: hashActual };
}

function verificarCadena(filas, valoresHash) {
  let hashEsperado = HASH_GENESIS;

  for (const fila of filas) {
    if (fila.hash_anterior !== hashEsperado) {
      return { integra: false, total: filas.length, id_roto: fila.id, mensaje: 'Cadena alterada: hash_anterior no coincide' };
    }
    if (generarHashEntrada(valoresHash(fila), hashEsperado) !== fila.hash_actual) {
      return { integra: false, total: filas.length, id_roto: fila.id, mensaje: 'Datos alterados: hash_actual no coincide' };
    }
    hashEsperado = fila.hash_actual;
  }

  return {
    integra: true,
    total: filas.length,
    ultimo_hash: hashEsperado,
    mensaje: filas.length === 0 ? 'Sin registros' : 'Cadena verificada'
  };
}

export async function verificarHistorial(idDonanteHash) {
  const { rows } = await query(
    'SELECT * FROM historial_donaciones WHERE id_donante_hash = $1 ORDER BY id ASC',
    [idDonanteHash]
  );
  return verificarCadena(rows, valoresHashDonacion);
}

export async function verificarLogs() {
  const { rows } = await query('SELECT * FROM auditoria_logs ORDER BY id ASC');
  return verificarCadena(rows, valoresHashLog);
}

export async function obtenerHistorialDonante(idDonanteHash) {
  const { rows } = await query(`
    SELECT h.id, h.fecha_donacion, h.grupo_sanguineo, h.id_hospital,
           ho.nombre AS hospital_nombre, h.region, h.hash_anterior, h.hash_actual
    FROM historial_donaciones h
    JOIN hospitales ho ON h.id_hospital = ho.id
    WHERE h.id_donante_hash = $1
    ORDER BY h.id ASC
  `, [idDonanteHash]);
  return rows;
}

export async function obtenerHashDonante(idUsuario) {
  const { rows } = await query('SELECT curp_hash FROM donantes WHERE id_usuario = $1', [idUsuario]);
  if (rows.length === 0) {
    throw errorNoEncontrado('Perfil de donante no encontrado');
  }
  return rows[0].curp_hash;
}

// Para que un hospital verifique al donante de una de sus notificaciones sin conocer su hash
export async function obtenerHashPorNotificacion(idNotificacion) {
  const { rows } = await query(`
    SELECT d.curp_hash, s.id_hospital
    FROM notificaciones n
    JOIN donantes d ON n.id_donante = d.id
    JOIN solicitudes s ON n.id_solicitud = s.id
    WHERE n.id = $1
  `, [idNotificacion]);
  if (rows.length === 0) {
    throw errorNoEncontrado('Notificacion no encontrada');
  }
  return { hash: rows[0].curp_hash, idHospital: rows[0].id_hospital };
}

export async function obtenerEstado() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM historial_donaciones) AS total_donaciones,
      (SELECT COUNT(DISTINCT id_donante_hash) FROM historial_donaciones) AS donantes_con_historial,
      (SELECT COUNT(*) FROM auditoria_logs) AS total_logs,
      (SELECT hash_actual FROM auditoria_logs ORDER BY id DESC LIMIT 1) AS ultimo_hash_logs
  `);
  return { ...rows[0], ultimo_hash_logs: rows[0].ultimo_hash_logs || HASH_GENESIS };
}
