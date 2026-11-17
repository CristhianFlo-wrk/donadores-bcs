import { query, transaccion } from '../../config/database.js';
import { errorValidacion, errorNoEncontrado, ErrorHttp, parsearId } from '../../utils/errores.js';
import { cifrar, descifrar } from '../../utils/crypto.js';
import { buscarCompatibles, sinIdDonante } from '../donantes/donantes.service.js';
import { registrarLog, ZONA_HORARIA } from '../auditoria/auditoria.service.js';
import { decodificarImagenes } from '../../utils/imagenes.js';

const URGENCIAS = ['critica', 'urgente', 'normal'];
export const ESTADOS = ['activa', 'completada', 'cancelada', 'falsa', 'caducada'];
const ESTADOS_CIERRE = ['completada', 'cancelada', 'falsa'];
// Solo las solicitudes ciudadanas caducan
const PLAZOS_CADUCIDAD = { normal: '21 days', urgente: '7 days', critica: '72 hours' };
const FALTAS_MAXIMAS = 2;
const HISTORIA_MAXIMA = 1000;
const UNIDADES_MAXIMAS = 20;

function parsearUnidades(valor) {
  if (valor === undefined || valor === null) return 1;
  const unidades = Number(valor);
  if (!Number.isInteger(unidades) || unidades < 1 || unidades > UNIDADES_MAXIMAS) {
    throw errorValidacion('unidades_requeridas debe ser un entero entre 1 y ' + UNIDADES_MAXIMAS);
  }
  return unidades;
}

function validarUrgencia(urgencia) {
  if (!URGENCIAS.includes(urgencia)) {
    throw errorValidacion('urgencia debe ser "critica", "urgente" o "normal"');
  }
}

function textoOpcional(valor, nombre, maximo) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (texto.length > maximo) {
    throw errorValidacion(nombre + ' admite hasta ' + maximo + ' caracteres');
  }
  return texto || null;
}

// El nombre completo del paciente lo ven el admin, el hospital donde esta y quien la pidio; los demas, sus iniciales
export function veNombreCompleto(usuario, idHospital, idAutor) {
  return usuario.rol === 'admin' || usuario.id === idAutor || (usuario.rol === 'hospital' && usuario.id_hospital === idHospital);
}

export function nombrePaciente(nombreCifrado, completo) {
  const nombre = descifrar(nombreCifrado);
  if (!nombre || completo) return nombre;
  return nombre.split(/\s+/).filter(Boolean).map((parte) => parte[0].toUpperCase() + '.').join(' ');
}

// Admin accede a cualquier hospital; un usuario hospital solo al suyo
export function verificarAccesoHospital(usuario, idHospital) {
  if (usuario.rol === 'admin') return;
  if (usuario.rol === 'hospital' && usuario.id_hospital === idHospital) return;
  throw new ErrorHttp(403, 'Sin permisos sobre las solicitudes de este hospital');
}

const ESPERA_CADUCIDAD_MS = 30000;
let ultimaCaducidad = 0;


export async function caducarVencidas({ forzar = false } = {}) {
  if (!forzar && Date.now() - ultimaCaducidad < ESPERA_CADUCIDAD_MS) return;
  ultimaCaducidad = Date.now();
  const { rowCount } = await query(`
    UPDATE solicitudes SET estado = 'caducada', fecha_cierre = NOW()
    WHERE estado = 'activa' AND fecha_caducidad < NOW()
    RETURNING id
  `);
  if (rowCount > 0) {
    console.log('[SOLICITUDES] ' + rowCount + ' solicitudes caducadas');
  }
}

// Para tests
export function reiniciarCaducidad() {
  ultimaCaducidad = 0;
}

async function validarHospitalYTipo(idHospital, idTipoSangre) {
  const hospital = await query('SELECT id FROM hospitales WHERE id = $1 AND activo = TRUE', [idHospital]);
  if (hospital.rows.length === 0) {
    throw errorValidacion('Hospital no encontrado o inactivo');
  }

  const tipo = await query('SELECT id FROM tipos_sangre WHERE id = $1', [idTipoSangre]);
  if (tipo.rows.length === 0) {
    throw errorValidacion('Tipo de sangre inválido');
  }
}

export async function crearSolicitud(idHospital, datos, contexto = {}) {
  const { id_tipo_sangre: idTipoSangre, urgencia, descripcion } = datos;

  if (!idTipoSangre || !urgencia) {
    throw errorValidacion('Faltan campos obligatorios: id_tipo_sangre y urgencia');
  }

  validarUrgencia(urgencia);

  parsearId(idTipoSangre, 'id_tipo_sangre');
  const unidadesRequeridas = parsearUnidades(datos.unidades_requeridas);

  await validarHospitalYTipo(idHospital, idTipoSangre);

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

// Un donante pide sangre para si o para otra persona. Devuelve el id; el controller notifica despues
export async function crearSolicitudCiudadana(idUsuario, datos, contexto = {}) {
  if (datos.consentimiento !== true) {
    throw errorValidacion('Debes confirmar que tienes autorización para compartir el nombre del paciente');
  }
  if (typeof datos.para_si_mismo !== 'boolean') {
    throw errorValidacion('para_si_mismo debe ser true o false');
  }

  const pacienteNombre = typeof datos.paciente_nombre === 'string' ? datos.paciente_nombre.trim() : '';
  if (pacienteNombre.length < 3 || pacienteNombre.length > 120) {
    throw errorValidacion('paciente_nombre debe tener entre 3 y 120 caracteres');
  }
  const pacienteExpediente = textoOpcional(datos.paciente_expediente, 'paciente_expediente', 40);
  const descripcion = textoOpcional(datos.descripcion, 'descripcion', 500);
  const historia = textoOpcional(datos.historia, 'historia', HISTORIA_MAXIMA);
  const imagenes = decodificarImagenes(datos.imagenes);
  if ((historia || imagenes.length > 0) && datos.consentimiento_publico !== true) {
    throw errorValidacion('Confirma que tienes permiso para mostrar el mensaje y las fotos a los donantes');
  }

  if (datos.id_hospital === undefined || datos.id_tipo_sangre === undefined) {
    throw errorValidacion('Faltan campos obligatorios: id_hospital e id_tipo_sangre');
  }
  const idHospital = parsearId(datos.id_hospital, 'id_hospital');
  const idTipoSangre = parsearId(datos.id_tipo_sangre, 'id_tipo_sangre');
  const { urgencia } = datos;
  validarUrgencia(urgencia);
  const unidadesRequeridas = parsearUnidades(datos.unidades_requeridas);

  // Una activa ya vencida no debe chocar con el indice unico: aqui no se espera los 30 s
  await caducarVencidas({ forzar: true });

  const donante = await query('SELECT faltas FROM donantes WHERE id_usuario = $1', [idUsuario]);
  if (donante.rows[0] && donante.rows[0].faltas >= FALTAS_MAXIMAS) {
    throw new ErrorHttp(403, 'No puedes crear solicitudes: tu cuenta tiene solicitudes marcadas como falsas');
  }

  await validarHospitalYTipo(idHospital, idTipoSangre);

  const idSolicitud = await transaccion(async (client) => {
    let insertada;
    try {
      insertada = await client.query(`
        INSERT INTO solicitudes (id_hospital, id_tipo_sangre, urgencia, unidades_requeridas, descripcion, estado,
                                 id_usuario_autor, paciente_nombre_cifrado, paciente_expediente_cifrado,
                                 para_si_mismo, por_confirmar, fecha_caducidad, historia)
        VALUES ($1, $2, $3, $4, $5, 'activa', $6, $7, $8, $9, TRUE, NOW() + $10::interval, $11)
        RETURNING id
      `, [idHospital, idTipoSangre, urgencia, unidadesRequeridas, descripcion, idUsuario,
        cifrar(pacienteNombre), cifrar(pacienteExpediente), datos.para_si_mismo,
        PLAZOS_CADUCIDAD[urgencia], historia]);
    } catch (error) {
      if (error.code === '23505') {
        throw new ErrorHttp(409, 'Ya tienes una solicitud activa. Cancélala o espera a que se cierre para pedir otra.');
      }
      throw error;
    }
    const id = insertada.rows[0].id;

    for (const [indice, imagen] of imagenes.entries()) {
      await client.query('INSERT INTO solicitud_imagenes (id_solicitud, orden, datos) VALUES ($1, $2, $3)', [id, indice + 1, imagen]);
    }

    // Nunca datos del paciente: lo que entra a la cadena de logs no se puede borrar
    const detalles = {
      id_solicitud: id,
      id_hospital: idHospital,
      id_tipo_sangre: idTipoSangre,
      urgencia,
      unidades_requeridas: unidadesRequeridas,
      ciudadana: true
    };
    if (imagenes.length > 0) detalles.imagenes = imagenes.length;
    if (historia) detalles.con_historia = true;
    await registrarLog(client, {
      idUsuario,
      accion: 'SOLICITUD_CREADA',
      detalles,
      ipOrigen: contexto.ip
    });

    return id;
  });

  console.log('[SOLICITUDES] Solicitud ciudadana creada id=' + idSolicitud + ' hospital=' + idHospital);

  return idSolicitud;
}

// Datos basicos de la solicitud sin detalle; lanza 404 si no existe
export async function obtenerSolicitudBase(idSolicitud) {
  await caducarVencidas();
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


export async function obtenerSolicitudPorId(idSolicitud, {
  incluirNotificaciones = false, incluirExpediente = incluirNotificaciones, nombreCompleto = incluirExpediente
} = {}) {
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
    ciudadana: solicitud.id_usuario_autor !== null,
    por_confirmar: solicitud.por_confirmar,
    fecha_caducidad: solicitud.fecha_caducidad,
    paciente: null,
    historia: null,
    imagenes: [],
    metricas: metricas[0]
  };

  if (resultado.ciudadana) {
    resultado.paciente = {
      nombre: nombrePaciente(solicitud.paciente_nombre_cifrado, nombreCompleto),
      para_si_mismo: solicitud.para_si_mismo
    };
    // Solo los ids: cada foto se pide aparte a /:id/imagenes/:idImagen
    const { rows: imagenes } = await query('SELECT id FROM solicitud_imagenes WHERE id_solicitud = $1 ORDER BY orden', [idSolicitud]);
    resultado.historia = solicitud.historia;
    resultado.imagenes = imagenes;
    if (incluirExpediente) {
      resultado.paciente.expediente = descifrar(solicitud.paciente_expediente_cifrado);
    }
  }

  if (incluirNotificaciones) {
    const { rows: notificaciones } = await query(`
      SELECT id, canal, estado, fecha_envio, fecha_respuesta
      FROM notificaciones
      WHERE id_solicitud = $1
      ORDER BY fecha_envio DESC
    `, [idSolicitud]);
    resultado.notificaciones = notificaciones;
  }

  return resultado;
}

// usuario: quien consulta, decide si ve el nombre completo del paciente.
// excluirAutor: id de usuario cuyas solicitudes no se listan (el donante ve las suyas en /mias).
// soloConfirmadas: deja fuera las ciudadanas que el hospital aun no confirma
export async function listarSolicitudes(usuario, filtros = {}) {
  const {
    estado, idHospital, region, limite = 50, excluirAutor = null, soloConfirmadas = false,
    texto = null, idTipoSangre = null, urgencia = null, origen = null, desde = null, hasta = null
  } = filtros;

  if (estado && !ESTADOS.includes(estado)) {
    throw errorValidacion('estado debe ser activa, completada, cancelada, falsa o caducada');
  }
  if (urgencia) {
    validarUrgencia(urgencia);
  }

  await caducarVencidas();

  const valores = [];
  let sql = `
    SELECT s.id, s.urgencia, s.estado, s.fecha_solicitud, s.id_hospital,
           s.unidades_requeridas, s.descripcion,
           (s.id_usuario_autor IS NOT NULL) AS ciudadana,
           s.por_confirmar, s.fecha_caducidad, s.paciente_nombre_cifrado,
           (SELECT COUNT(*) FROM notificaciones n WHERE n.id_solicitud = s.id AND n.estado = 'donada') AS unidades_donadas,
           (s.historia IS NOT NULL) AS tiene_historia,
           (SELECT COUNT(*) FROM solicitud_imagenes i WHERE i.id_solicitud = s.id)::int AS total_imagenes,
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

  if (excluirAutor) {
    valores.push(excluirAutor);
    sql += ` AND s.id_usuario_autor IS DISTINCT FROM $${valores.length}`;
  }

  if (soloConfirmadas) {
    sql += ' AND NOT s.por_confirmar';
  }

  if (idTipoSangre) {
    valores.push(idTipoSangre);
    sql += ` AND s.id_tipo_sangre = $${valores.length}`;
  }

  if (urgencia) {
    valores.push(urgencia);
    sql += ` AND s.urgencia = $${valores.length}`;
  }

  if (origen) {
    sql += origen === 'ciudadana' ? ' AND s.id_usuario_autor IS NOT NULL' : ' AND s.id_usuario_autor IS NULL';
  }

  // Dias de Baja California Sur, igual que la bitacora
  if (desde) {
    valores.push(desde);
    sql += ` AND s.fecha_solicitud >= $${valores.length}::date::timestamp AT TIME ZONE '${ZONA_HORARIA}'`;
  }
  if (hasta) {
    valores.push(hasta);
    sql += ` AND s.fecha_solicitud < ($${valores.length}::date + 1)::timestamp AT TIME ZONE '${ZONA_HORARIA}'`;
  }

  const porId = texto && texto.match(PATRON_ID);
  const porCodigo = texto && texto.match(PATRON_CODIGO);
  if (porId) {
    valores.push(Number(porId[1]));
    sql += ` AND s.id = $${valores.length}`;
  } else if (porCodigo) {
    valores.push(Number(porCodigo[1]));
    sql += ` AND EXISTS (SELECT 1 FROM notificaciones n WHERE n.id_solicitud = s.id AND n.id = $${valores.length})`;
  }
  const buscaTexto = texto && !porId && !porCodigo;

  
  valores.push(buscaTexto ? LIMITE_BUSQUEDA_TEXTO : limite);
  sql += ` ORDER BY CASE s.urgencia WHEN 'critica' THEN 0 WHEN 'urgente' THEN 1 ELSE 2 END, s.fecha_solicitud DESC LIMIT $${valores.length}`;

  const { rows } = await query(sql, valores);
  const solicitudes = rows.map(({ paciente_nombre_cifrado: nombreCifrado, ...fila }) => ({
    ...fila,
    paciente_nombre: nombrePaciente(nombreCifrado, veNombreCompleto(usuario, fila.id_hospital, null))
  }));
  if (!buscaTexto) return solicitudes;

  const buscado = sinAcentos(texto);
  return solicitudes
    .filter((s) => [s.paciente_nombre, s.descripcion, s.hospital_nombre].some((campo) => campo && sinAcentos(campo).includes(buscado)))
    .slice(0, limite);
}

const PATRON_ID = /^#?(\d{1,9})$/;
const PATRON_CODIGO = /^N-?(\d{1,9})$/i;
const LIMITE_BUSQUEDA_TEXTO = 500;

function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export async function listarSolicitudesAutor(idUsuario) {
  await caducarVencidas();

  const donante = await query('SELECT faltas FROM donantes WHERE id_usuario = $1', [idUsuario]);

  const { rows } = await query(`
    SELECT s.id, s.estado, s.urgencia, s.por_confirmar, s.para_si_mismo,
           s.paciente_nombre_cifrado, s.paciente_expediente_cifrado,
           ts.codigo AS tipo_sangre, h.nombre AS hospital_nombre, h.region AS region,
           s.unidades_requeridas,
           (SELECT COUNT(*) FROM notificaciones n WHERE n.id_solicitud = s.id AND n.estado = 'donada') AS unidades_donadas,
           (SELECT COUNT(*) FROM notificaciones n WHERE n.id_solicitud = s.id AND n.estado IN ('confirmada', 'donada')) AS confirmaciones,
           s.fecha_solicitud, s.fecha_caducidad, s.fecha_cierre
    FROM solicitudes s
    JOIN hospitales h ON s.id_hospital = h.id
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    WHERE s.id_usuario_autor = $1
    ORDER BY s.fecha_solicitud DESC
    LIMIT 50
  `, [idUsuario]);

  const solicitudes = rows.map(({ paciente_nombre_cifrado: nombreCifrado, paciente_expediente_cifrado: expedienteCifrado, ...fila }) => ({
    ...fila,
    paciente_nombre: descifrar(nombreCifrado),
    paciente_expediente: descifrar(expedienteCifrado)
  }));

  return { faltas: donante.rows[0] ? donante.rows[0].faltas : 0, solicitudes };
}

export async function buscarCandidatos(idSolicitud, filtros = {}) {
  const solicitud = await obtenerSolicitudBase(idSolicitud);

  if (solicitud.estado !== 'activa') {
    throw errorValidacion('La solicitud no está activa');
  }

  const candidatos = await buscarCompatibles(solicitud.id_tipo_sangre, {
    region: filtros.region || null,
    excluirUsuario: solicitud.id_usuario_autor,
    limite: filtros.limite || 50
  });

  return {
    id_solicitud: solicitud.id,
    hospital_region: solicitud.hospital_region,
    tipo_sangre_requerido: solicitud.tipo_sangre,
    total_candidatos: candidatos.length,
    candidatos: sinIdDonante(candidatos)
  };
}

export async function cerrarSolicitud(idSolicitud, nuevoEstado, contexto = {}, opcionesRespuesta = { incluirNotificaciones: true }) {
  if (!ESTADOS_CIERRE.includes(nuevoEstado)) {
    throw errorValidacion('estado debe ser "completada", "cancelada" o "falsa"');
  }

  
  const condicion = nuevoEstado === 'falsa'
    ? "(estado = 'activa' OR (estado IN ('cancelada', 'caducada') AND id_usuario_autor IS NOT NULL))" +
      " AND NOT EXISTS (SELECT 1 FROM notificaciones n WHERE n.id_solicitud = solicitudes.id AND n.estado = 'donada')"
    : "estado = 'activa'";

  
  const cerrada = await transaccion(async (client) => {
    const { rows } = await client.query(`
      UPDATE solicitudes
      SET estado = $1, fecha_cierre = COALESCE(fecha_cierre, NOW())
      WHERE id = $2 AND ${condicion}
      RETURNING id_usuario_autor
    `, [nuevoEstado, idSolicitud]);

    if (rows.length === 0) return false;

    if (nuevoEstado === 'falsa') {
      await client.query('UPDATE donantes SET faltas = faltas + 1 WHERE id_usuario = $1', [rows[0].id_usuario_autor]);
    }

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
    if (nuevoEstado === 'falsa' && ['activa', 'cancelada', 'caducada'].includes(solicitud.estado)) {
      throw errorValidacion('No se marca como falsa una solicitud con donaciones registradas');
    }
    throw errorValidacion('La solicitud ya está ' + solicitud.estado);
  }

  console.log('[SOLICITUDES] Solicitud id=' + idSolicitud + ' cerrada como ' + nuevoEstado);

  return obtenerSolicitudPorId(idSolicitud, opcionesRespuesta);
}


export async function cambiarUrgencia(idSolicitud, urgencia, contexto = {}) {
  validarUrgencia(urgencia);

  return transaccion(async (client) => {
    const { rows } = await client.query(
      'SELECT estado, urgencia, por_confirmar, id_usuario_autor FROM solicitudes WHERE id = $1 FOR UPDATE',
      [idSolicitud]
    );
    const solicitud = rows[0];
    if (!solicitud) {
      throw errorNoEncontrado('Solicitud no encontrada');
    }
    if (solicitud.id_usuario_autor === null) {
      throw errorValidacion('Solo se cambia la urgencia de una solicitud ciudadana');
    }
    if (solicitud.estado !== 'activa') {
      throw errorValidacion('La solicitud no está activa');
    }
    if (solicitud.urgencia === urgencia && !solicitud.por_confirmar) {
      throw errorValidacion('La solicitud ya tiene esa urgencia');
    }

    await client.query(`
      UPDATE solicitudes
      SET urgencia = $1, por_confirmar = FALSE, fecha_caducidad = NOW() + $2::interval
      WHERE id = $3
    `, [urgencia, PLAZOS_CADUCIDAD[urgencia], idSolicitud]);

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: solicitud.por_confirmar ? 'SOLICITUD_CONFIRMADA' : 'URGENCIA_CAMBIADA',
      detalles: { id_solicitud: idSolicitud, urgencia_anterior: solicitud.urgencia, urgencia },
      ipOrigen: contexto.ip
    });

    console.log('[SOLICITUDES] Solicitud id=' + idSolicitud + (solicitud.por_confirmar ? ' confirmada' : ' cambio') + ' con urgencia ' + urgencia);
    return solicitud.por_confirmar;
  });
}

export const DIAS_CONSERVACION_PUBLICACION = 30;


export async function purgarPublicacionVencida(dias = DIAS_CONSERVACION_PUBLICACION) {
  const vencida = "s.estado <> 'activa' AND s.fecha_cierre <= NOW() - make_interval(days => $1)";
  const borradas = await transaccion(async (client) => {
    const fotos = await client.query(`DELETE FROM solicitud_imagenes i USING solicitudes s WHERE i.id_solicitud = s.id AND ${vencida}`, [dias]);
    const mensajes = await client.query(`UPDATE solicitudes s SET historia = NULL WHERE s.historia IS NOT NULL AND ${vencida}`, [dias]);
    const resultado = { fotos: fotos.rowCount, mensajes: mensajes.rowCount };
    if (resultado.fotos + resultado.mensajes > 0) {
      await registrarLog(client, { accion: 'PUBLICACIONES_BORRADAS_POR_PLAZO', detalles: { ...resultado, plazo_dias: dias } });
    }
    return resultado;
  });
  if (borradas.fotos + borradas.mensajes > 0) {
    console.log('[SOLICITUDES] Borrados por plazo vencido: ' + borradas.fotos + ' fotos y ' + borradas.mensajes + ' mensajes');
  }
  return borradas;
}

export async function obtenerImagen(idSolicitud, idImagen) {
  const { rows } = await query('SELECT datos FROM solicitud_imagenes WHERE id = $1 AND id_solicitud = $2', [idImagen, idSolicitud]);
  if (rows.length === 0) {
    throw errorNoEncontrado('Imagen no encontrada');
  }
  return rows[0].datos;
}

export async function quitarImagen(idSolicitud, idImagen, contexto = {}) {
  await transaccion(async (client) => {
    const { rowCount } = await client.query('DELETE FROM solicitud_imagenes WHERE id = $1 AND id_solicitud = $2', [idImagen, idSolicitud]);
    if (rowCount === 0) {
      throw errorNoEncontrado('Imagen no encontrada');
    }
    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'IMAGEN_QUITADA',
      detalles: { id_solicitud: idSolicitud, id_imagen: idImagen },
      ipOrigen: contexto.ip
    });
  });
  console.log('[SOLICITUDES] Imagen id=' + idImagen + ' quitada de la solicitud id=' + idSolicitud);
}

export async function quitarHistoria(idSolicitud, contexto = {}) {
  await transaccion(async (client) => {
    const { rowCount } = await client.query('UPDATE solicitudes SET historia = NULL WHERE id = $1 AND historia IS NOT NULL', [idSolicitud]);
    if (rowCount === 0) {
      throw errorValidacion('La solicitud no tiene mensaje');
    }
    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'HISTORIA_QUITADA',
      detalles: { id_solicitud: idSolicitud },
      ipOrigen: contexto.ip
    });
  });
  console.log('[SOLICITUDES] Mensaje quitado de la solicitud id=' + idSolicitud);
}
