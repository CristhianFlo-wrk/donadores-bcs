import { query, transaccion } from '../../config/database.js';
import { generarHash, generarHashEntrada, generarHmac, HASH_GENESIS } from '../../utils/hash.js';
import { ErrorHttp, errorNoEncontrado } from '../../utils/errores.js';

// Llave fija del advisory lock que serializa la cadena global de auditoria_logs
const LOCK_AUDITORIA_LOGS = 7310001;

// Filas que la verificacion lee por consulta
const LOTE_VERIFICACION = 5000;

const HEX = (columna) => `encode(${columna}, 'hex')`;

// Orden fijo de campos que entran al hash de cada cadena. Cambiarlo invalida las cadenas existentes
function valoresHashDonacion(fila) {
  return [fila.id_donante_hash, fila.fecha_donacion, fila.grupo_sanguineo, fila.id_hospital, fila.region];
}

function valoresHashLog(fila) {
  return [fila.id_usuario, fila.accion, jsonCanonico(fila.detalles), fila.ip_hmac, fila.fecha];
}

function huellaIp(ip) {
  return ip ? generarHmac('ip:' + ip) : null;
}
export const DIAS_CONSERVACION_IP = 90;

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
    SELECT ${HEX('hash_actual')} AS hash_actual FROM historial_donaciones
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
    INSERT INTO historial_donaciones (id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, region, hash_actual)
    VALUES ($1, $2, $3, $4, $5, decode($6, 'hex'))
    RETURNING id
  `, [idDonanteHash, entrada.fecha_donacion, grupoSanguineo, idHospital, region, hashActual]);

  console.log('[AUDITORIA] Entrada de donacion registrada id=' + rows[0].id);

  return { id: rows[0].id, ...entrada, hash_actual: hashActual };
}

// Registra una accion en la cadena global. Con client usa la transaccion abierta; sin client abre una propia
export async function registrarLog(client, { idUsuario = null, accion, detalles = null, ipOrigen = null }) {
  if (!client) {
    return transaccion((nuevoClient) => registrarLog(nuevoClient, { idUsuario, accion, detalles, ipOrigen }));
  }

  await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_AUDITORIA_LOGS]);

  const ultimo = await client.query(`SELECT ${HEX('hash_actual')} AS hash_actual FROM auditoria_logs ORDER BY id DESC LIMIT 1`);
  const hashAnterior = ultimo.rows.length > 0 ? ultimo.rows[0].hash_actual : HASH_GENESIS;

  const log = { id_usuario: idUsuario, accion, detalles, ip_hmac: huellaIp(ipOrigen), fecha: await ahora(client) };
  const hashActual = generarHashEntrada(valoresHashLog(log), hashAnterior);

  const { rows } = await client.query(`
    INSERT INTO auditoria_logs (id_usuario, accion, detalles, ip_origen, ip_hmac, fecha, hash_actual)
    VALUES ($1, $2, $3, $4, decode($5, 'hex'), $6, decode($7, 'hex'))
    RETURNING id
  `, [idUsuario, accion, detalles === null ? null : JSON.stringify(detalles), ipOrigen || null, log.ip_hmac, log.fecha, hashActual]);

  return { id: rows[0].id, hash_actual: hashActual };
}

function revisarIp(fila) {
  if (fila.ip_origen !== null && huellaIp(fila.ip_origen) !== fila.ip_hmac) {
    return 'Datos alterados: la IP no coincide con su huella';
  }
  if (fila.ip_origen === null && fila.ip_hmac !== null && fila.dentro_de_plazo) {
    return 'Datos alterados: la IP se borró antes de su plazo';
  }
  return null;
}

const CADENAS = {
  donaciones: {
    tabla: 'historial_donaciones',
    columnas: () => `id, id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, region, ${HEX('hash_actual')} AS hash_actual`,
    parametros: () => [],
    clave: (fila) => fila.id_donante_hash,
    valoresHash: valoresHashDonacion,
    revisarFila: () => null,
    // Ultimo hash de cada donante hasta el id dado, para seguir su cadena desde ahi
    hashesPrevios: async (hastaId, claves) => {
      const { rows } = await query(`
        SELECT DISTINCT ON (id_donante_hash) id_donante_hash AS clave, ${HEX('hash_actual')} AS hash_actual
        FROM historial_donaciones
        WHERE id <= $1 AND id_donante_hash = ANY($2)
        ORDER BY id_donante_hash, id DESC
      `, [hastaId, claves]);
      return rows;
    }
  },
  logs: {
    tabla: 'auditoria_logs',
    columnas: (indiceDias) => `id, id_usuario, accion, detalles, ip_origen, ${HEX('ip_hmac')} AS ip_hmac, fecha, ${HEX('hash_actual')} AS hash_actual,
      fecha > NOW() - make_interval(days => $${indiceDias}) AS dentro_de_plazo`,
    parametros: (dias) => [dias],
    clave: () => 'global',
    valoresHash: valoresHashLog,
    revisarFila: revisarIp,
    hashesPrevios: async (hastaId) => {
      const { rows } = await query(`SELECT 'global' AS clave, ${HEX('hash_actual')} AS hash_actual FROM auditoria_logs WHERE id <= $1 ORDER BY id DESC LIMIT 1`, [hastaId]);
      return rows;
    }
  }
};

// El hash de cada fila se calcula con el hash de la fila anterior de su misma cadena.
// Sin hash_anterior guardado: una fila alterada, insertada o borrada hace que no coincida la siguiente
function revisarEslabon(cadena, fila, anterior) {
  if (generarHashEntrada(cadena.valoresHash(fila), anterior) !== fila.hash_actual) {
    return 'El hash no coincide: este registro o uno anterior de su cadena fue alterado o borrado';
  }
  return cadena.revisarFila(fila);
}

async function recorrerCadena(cadena, { desdeId = 0, dias = DIAS_CONSERVACION_IP } = {}) {
  const ultimos = new Map();
  let ultimoId = desdeId;
  let ultimoHash = null;
  let revisados = 0;

  for (;;) {
    const extra = cadena.parametros(dias);
    const { rows } = await query(
      `SELECT ${cadena.columnas(3)} FROM ${cadena.tabla} WHERE id > $1 ORDER BY id LIMIT $2`,
      [ultimoId, LOTE_VERIFICACION, ...extra]
    );
    if (rows.length === 0) break;

    if (desdeId > 0) {
      const faltantes = [...new Set(rows.map(cadena.clave))].filter((clave) => !ultimos.has(clave));
      if (faltantes.length > 0) {
        for (const previo of await cadena.hashesPrevios(desdeId, faltantes)) ultimos.set(previo.clave, previo.hash_actual);
      }
    }

    for (const fila of rows) {
      const clave = cadena.clave(fila);
      const problema = revisarEslabon(cadena, fila, ultimos.get(clave) ?? HASH_GENESIS);
      if (problema) {
        return { integra: false, id_roto: fila.id, mensaje: problema, revisados: revisados + 1 };
      }
      ultimos.set(clave, fila.hash_actual);
      ultimoId = fila.id;
      ultimoHash = fila.hash_actual;
      revisados++;
    }
    if (rows.length < LOTE_VERIFICACION) break;
  }

  return { integra: true, revisados, ultimoId, ultimoHash };
}

// Verificacion completa de la bitacora, sin tocar el punto de control
export async function verificarLogs(dias = DIAS_CONSERVACION_IP) {
  const resultado = await recorrerCadena(CADENAS.logs, { dias });
  if (!resultado.integra) return { ...resultado, total: resultado.revisados };
  return {
    integra: true,
    total: resultado.revisados,
    ultimo_hash: resultado.ultimoHash,
    mensaje: resultado.revisados === 0 ? 'Sin registros' : 'Cadena verificada'
  };
}

// Historial de un solo donante: pocas filas, se verifica completo
export async function verificarHistorial(idDonanteHash) {
  const cadena = CADENAS.donaciones;
  const { rows } = await query(
    `SELECT ${cadena.columnas()} FROM historial_donaciones WHERE id_donante_hash = $1 ORDER BY id ASC`,
    [idDonanteHash]
  );

  let anterior = HASH_GENESIS;
  for (const fila of rows) {
    const problema = revisarEslabon(cadena, fila, anterior);
    if (problema) return { integra: false, total: rows.length, id_roto: fila.id, mensaje: problema };
    anterior = fila.hash_actual;
  }
  return {
    integra: true,
    total: rows.length,
    ultimo_hash: rows.length > 0 ? anterior : HASH_GENESIS,
    mensaje: rows.length === 0 ? 'Sin registros' : 'Cadena verificada'
  };
}


export async function purgarIpsVencidas(dias = DIAS_CONSERVACION_IP) {
  const borradas = await transaccion(async (client) => {
    const { rowCount } = await client.query(
      'UPDATE auditoria_logs SET ip_origen = NULL WHERE ip_origen IS NOT NULL AND fecha <= NOW() - make_interval(days => $1)',
      [dias]
    );
    if (rowCount > 0) {
      await registrarLog(client, { accion: 'IPS_BORRADAS_POR_PLAZO', detalles: { ips_borradas: rowCount, plazo_dias: dias } });
    }
    return rowCount;
  });
  if (borradas > 0) console.log('[AUDITORIA] IPs borradas por plazo vencido: ' + borradas);
  return borradas;
}

async function leerPuntoControl(nombre) {
  const { rows } = await query(`
    SELECT id_hasta, ${HEX('hash_hasta')} AS hash_hasta, fecha_verificacion, fecha_completa, id_roto, mensaje_roto
    FROM auditoria_puntos_control WHERE cadena = $1
  `, [nombre]);
  return rows[0] || null;
}

// Una alteracion detectada queda guardada: la verificacion rapida la sigue mostrando hasta que una completa la descarte
async function guardarPuntoControl(nombre, { completa, resultado }) {
  if (!resultado.integra) {
    await query(`
      INSERT INTO auditoria_puntos_control (cadena, id_hasta, hash_hasta, id_roto, mensaje_roto)
      VALUES ($1, 0, decode($2, 'hex'), $3, $4)
      ON CONFLICT (cadena) DO UPDATE SET id_roto = $3, mensaje_roto = $4, fecha_verificacion = NOW()
    `, [nombre, HASH_GENESIS, resultado.id_roto, resultado.mensaje]);
    return;
  }
  if (resultado.revisados === 0 && !completa) {
    await query('UPDATE auditoria_puntos_control SET fecha_verificacion = NOW() WHERE cadena = $1', [nombre]);
    return;
  }
  if (resultado.revisados === 0) {
    await query('UPDATE auditoria_puntos_control SET fecha_verificacion = NOW(), fecha_completa = NOW(), id_roto = NULL, mensaje_roto = NULL WHERE cadena = $1', [nombre]);
    return;
  }
  await query(`
    INSERT INTO auditoria_puntos_control (cadena, id_hasta, hash_hasta, fecha_completa)
    VALUES ($1, $2, decode($3, 'hex'), CASE WHEN $4::boolean THEN NOW() END)
    ON CONFLICT (cadena) DO UPDATE SET
      id_hasta = $2,
      hash_hasta = decode($3, 'hex'),
      fecha_verificacion = NOW(),
      fecha_completa = CASE WHEN $4::boolean THEN NOW() ELSE auditoria_puntos_control.fecha_completa END,
      id_roto = CASE WHEN $4::boolean THEN NULL ELSE auditoria_puntos_control.id_roto END,
      mensaje_roto = CASE WHEN $4::boolean THEN NULL ELSE auditoria_puntos_control.mensaje_roto END
  `, [nombre, resultado.ultimoId, resultado.ultimoHash, completa]);
}


async function verificarConPuntoControl(nombre, completa) {
  const cadena = CADENAS[nombre];
  const punto = await leerPuntoControl(nombre);

  if (!completa && punto && punto.id_roto !== null) {
    return { integra: false, id_roto: punto.id_roto, mensaje: punto.mensaje_roto, modo: 'rapida', revisados: 0, punto };
  }

  const desdeId = !completa && punto ? punto.id_hasta : 0;
  if (desdeId > 0) {
    const { rows } = await query(`SELECT ${HEX('hash_actual')} AS hash_actual FROM ${cadena.tabla} WHERE id = $1`, [desdeId]);
    if (rows.length === 0 || rows[0].hash_actual !== punto.hash_hasta) {
      const resultado = { integra: false, id_roto: desdeId, mensaje: 'El último registro verificado fue alterado o borrado', revisados: 0 };
      await guardarPuntoControl(nombre, { completa, resultado });
      return { ...resultado, modo: 'rapida', punto: await leerPuntoControl(nombre) };
    }
  }

  const resultado = await recorrerCadena(cadena, { desdeId });
  await guardarPuntoControl(nombre, { completa, resultado });
  const actualizado = await leerPuntoControl(nombre);
  return {
    ...resultado,
    ultimoHash: resultado.ultimoHash || (actualizado ? actualizado.hash_hasta : null),
    modo: completa ? 'completa' : 'rapida',
    punto: actualizado
  };
}

function formatoVerificacion(resultado, total) {
  const base = {
    integra: resultado.integra,
    total,
    modo: resultado.modo,
    revisados: resultado.revisados,
    verificado_hasta: resultado.punto ? resultado.punto.id_hasta : 0,
    ultima_completa: resultado.punto ? resultado.punto.fecha_completa : null
  };
  if (!resultado.integra) return { ...base, id_roto: resultado.id_roto, mensaje: resultado.mensaje };
  return { ...base, ultimo_hash: total === 0 ? null : resultado.ultimoHash, mensaje: total === 0 ? 'Sin registros' : 'Cadena verificada' };
}

export async function obtenerEstado({ completa = false } = {}) {
  const [donaciones, logs, conteos] = await Promise.all([
    verificarConPuntoControl('donaciones', completa),
    verificarConPuntoControl('logs', completa),
    query(`
      SELECT (SELECT COUNT(*) FROM historial_donaciones)::int AS donaciones,
             (SELECT COUNT(DISTINCT id_donante_hash) FROM historial_donaciones)::int AS donantes,
             (SELECT COUNT(*) FROM auditoria_logs)::int AS logs
    `)
  ]);
  const totales = conteos.rows[0];
  return {
    total_donaciones: totales.donaciones,
    donantes_con_historial: totales.donantes,
    total_logs: totales.logs,
    verificacion_donaciones: { ...formatoVerificacion(donaciones, totales.donaciones), donantes: totales.donantes },
    verificacion_logs: formatoVerificacion(logs, totales.logs)
  };
}

export async function obtenerHistorialDonante(idDonanteHash) {
  const { rows } = await query(`
    SELECT h.id, h.fecha_donacion, h.grupo_sanguineo, h.id_hospital,
           ho.nombre AS hospital_nombre, h.region, ${HEX('h.hash_actual')} AS hash_actual
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
    throw errorNoEncontrado('Notificación no encontrada');
  }
  return { hash: rows[0].curp_hash, idHospital: rows[0].id_hospital };
}

// Id numerico guardado en detalles; un valor alterado a mano no rompe el CAST
const idDetalle = (llave) => `CASE WHEN l.detalles->>'${llave}' ~ '^[0-9]{1,9}$' THEN (l.detalles->>'${llave}')::int END`;

// Los dias del filtro de fechas son dias de Baja California Sur
export const ZONA_HORARIA = 'America/Mazatlan';


export async function listarBitacora({ limite, acciones, antes, usuario, idHospital, region, desde, hasta, idSolicitud = null }) {
  const { rows } = await query(`
    SELECT * FROM (
      SELECT l.id, l.fecha, l.accion, l.id_usuario, u.email, u.rol, l.ip_origen, s.id AS id_solicitud, (l.ip_origen IS NULL AND l.ip_hmac IS NOT NULL) AS ip_borrada,
             l.detalles, ${HEX('l.hash_actual')} AS hash_actual,
             ho.id AS id_hospital, ho.nombre AS hospital_nombre,
             COALESCE(ho.region, l.detalles->>'region', d.region) AS region
      FROM auditoria_logs l
      LEFT JOIN usuarios u ON l.id_usuario = u.id
      LEFT JOIN donantes d ON d.id_usuario = u.id
      LEFT JOIN solicitudes s ON s.id = ${idDetalle('id_solicitud')}
      LEFT JOIN hospitales ho ON ho.id = COALESCE(s.id_hospital, ${idDetalle('id_hospital')}, u.id_hospital)
    ) b
    WHERE ($1::text[] IS NULL OR b.accion = ANY($1))
      AND ($2::int IS NULL OR b.id < $2)
      AND ($3::text IS NULL OR position(lower($3) in lower(b.email)) > 0)
      AND ($4::int IS NULL OR b.id_hospital = $4)
      AND ($5::text IS NULL OR b.region = $5)
      AND ($6::date IS NULL OR b.fecha >= $6::date::timestamp AT TIME ZONE '${ZONA_HORARIA}')
      AND ($7::date IS NULL OR b.fecha < ($7::date + 1)::timestamp AT TIME ZONE '${ZONA_HORARIA}')
      AND ($9::int IS NULL OR b.id_solicitud = $9)
    ORDER BY b.id DESC
    LIMIT $8
  `, [acciones, antes, usuario, idHospital, region, desde, hasta, limite + 1, idSolicitud]);
  return { entradas: rows.slice(0, limite), hayMas: rows.length > limite };
}

export async function registrarConsultaAuditoria(contexto) {
  const reciente = await query(`
    SELECT 1 FROM auditoria_logs
    WHERE id_usuario = $1 AND accion = 'AUDITORIA_CONSULTADA' AND fecha > NOW() - INTERVAL '10 minutes'
    LIMIT 1
  `, [contexto.idUsuario]);
  if (reciente.rows.length > 0) return;
  await registrarLog(null, { idUsuario: contexto.idUsuario, accion: 'AUDITORIA_CONSULTADA', ipOrigen: contexto.ip });
}

// Ficha de un registro de la bitacora con todo lo que entro a su sello, para recalcularlo fuera del servidor
export async function obtenerEslabon(id) {
  const { rows } = await query(`
    SELECT id, id_usuario, accion, detalles, ${HEX('ip_hmac')} AS ip_hmac, fecha, ${HEX('hash_actual')} AS hash_actual
    FROM auditoria_logs WHERE id = $1
  `, [id]);
  if (rows.length === 0) {
    throw errorNoEncontrado('Registro no encontrado');
  }
  const fila = rows[0];
  const [anterior, siguiente] = await Promise.all([
    query(`SELECT id, ${HEX('hash_actual')} AS hash_actual FROM auditoria_logs WHERE id < $1 ORDER BY id DESC LIMIT 1`, [id]),
    query('SELECT id FROM auditoria_logs WHERE id > $1 ORDER BY id ASC LIMIT 1', [id])
  ]);
  const selloAnterior = anterior.rows[0] ? anterior.rows[0].hash_actual : HASH_GENESIS;

  return {
    id: fila.id,
    // Mismo orden que valoresHashLog: el frontend recalcula el sello con estos campos
    campos: { id_usuario: fila.id_usuario, accion: fila.accion, detalles: fila.detalles, ip_hmac: fila.ip_hmac, fecha: fila.fecha },
    id_anterior: anterior.rows[0] ? anterior.rows[0].id : null,
    sello_anterior: selloAnterior,
    sello: fila.hash_actual,
    id_siguiente: siguiente.rows[0] ? siguiente.rows[0].id : null,
    coincide_servidor: generarHashEntrada(valoresHashLog(fila), selloAnterior) === fila.hash_actual
  };
}

// Sello de una constancia
async function sellosHasta(logsHasta, donacionesHasta) {
  const { rows } = await query(`
    SELECT (SELECT ${HEX('hash_actual')} FROM auditoria_logs WHERE id = $1) AS sello_logs,
           (SELECT COUNT(*) FROM auditoria_logs WHERE id <= $1)::int AS registros_logs,
           (SELECT ${HEX("sha256(string_agg(hash_actual, ''::bytea ORDER BY id))")} FROM historial_donaciones WHERE id <= $2) AS sello_donaciones,
           (SELECT COUNT(*) FROM historial_donaciones WHERE id <= $2)::int AS registros_donaciones
  `, [logsHasta, donacionesHasta]);
  const fila = rows[0];
  const sello = fila.sello_logs
    ? generarHash(['constancia', logsHasta, fila.sello_logs, donacionesHasta, fila.sello_donaciones || ''].join('|'))
    : null;
  return { ...fila, sello };
}

// Antes de emitir se recorren las cadenas completas: no se certifica una historia ya alterada
export async function emitirConstancia(contexto) {
  const estado = await obtenerEstado({ completa: true });
  for (const verificacion of [estado.verificacion_logs, estado.verificacion_donaciones]) {
    if (!verificacion.integra) {
      throw new ErrorHttp(409, 'No se puede emitir la constancia: el registro #' + verificacion.id_roto + ' fue alterado');
    }
  }
  const logsHasta = estado.verificacion_logs.verificado_hasta;
  const donacionesHasta = estado.verificacion_donaciones.verificado_hasta;
  if (!logsHasta) {
    throw new ErrorHttp(409, 'Todavía no hay registros que certificar');
  }

  const sellos = await sellosHasta(logsHasta, donacionesHasta);
  const log = await registrarLog(null, {
    idUsuario: contexto.idUsuario,
    accion: 'CONSTANCIA_EMITIDA',
    detalles: { logs_hasta: logsHasta, donaciones_hasta: donacionesHasta, sello: sellos.sello },
    ipOrigen: contexto.ip
  });
  const { rows } = await query('SELECT fecha FROM auditoria_logs WHERE id = $1', [log.id]);
  console.log('[AUDITORIA] Constancia emitida, folio ' + log.id);

  return {
    folio: log.id,
    fecha: rows[0].fecha,
    logs_hasta: logsHasta,
    registros_logs: sellos.registros_logs,
    donaciones_hasta: donacionesHasta,
    registros_donaciones: sellos.registros_donaciones,
    sello: sellos.sello
  };
}

export async function comprobarConstancia({ logsHasta, donacionesHasta, sello: selloIngresado }, contexto) {
  const estado = await obtenerEstado({ completa: true });
  const sellos = await sellosHasta(logsHasta, donacionesHasta);

  // Una alteracion dentro del rango de la constancia la invalida; una posterior no, pero el auditor debe saberlo
  const cadenas = [[estado.verificacion_logs, logsHasta], [estado.verificacion_donaciones, donacionesHasta]];
  const dentro = cadenas.find(([verificacion, hasta]) => !verificacion.integra && verificacion.id_roto <= hasta);
  const posterior = cadenas.find(([verificacion, hasta]) => !verificacion.integra && verificacion.id_roto > hasta);

  let resultado = 'coincide';
  if (!sellos.sello) resultado = 'registro_inexistente';
  else if (dentro) resultado = 'cadena_alterada';
  else if (!sellos.sello.startsWith(selloIngresado)) resultado = 'sello_distinto';

  await registrarLog(null, {
    idUsuario: contexto.idUsuario,
    accion: 'CONSTANCIA_COMPROBADA',
    detalles: { logs_hasta: logsHasta, donaciones_hasta: donacionesHasta, resultado },
    ipOrigen: contexto.ip
  });

  return {
    resultado,
    coincide: resultado === 'coincide',
    id_roto: dentro ? dentro[0].id_roto : null,
    alteracion_posterior: posterior ? posterior[0].id_roto : null,
    registros_logs: sellos.registros_logs,
    registros_donaciones: sellos.registros_donaciones
  };
}
