import { query, transaccion } from '../../config/database.js';
import { ErrorHttp, errorNoEncontrado, errorValidacion, parsearId } from '../../utils/errores.js';
import { registrarLog } from '../auditoria/auditoria.service.js';
import { municipioActivo, textoObligatorio, validarPuntoBcs } from '../ubicaciones/ubicaciones.service.js';

export const INSTITUCIONES = ['IMSS', 'IMSS-BIENESTAR', 'ISSSTE', 'SSBCS', 'privado', 'otro'];

const REGEX_CLUES = /^BS[A-Z]{3}\d{6}$/;

const CAMPOS = `h.id, h.nombre, h.institucion, h.clues, h.id_municipio, m.nombre AS municipio, h.region,
  h.direccion, h.telefono, h.latitud, h.longitud, h.activo`;
const DESDE = 'FROM hospitales h LEFT JOIN municipios m ON m.id = h.id_municipio';

export async function listarHospitales({ region, incluirInactivos = false } = {}) {
  const valores = [];
  let sql = `SELECT ${CAMPOS} ${DESDE} WHERE (h.activo = TRUE OR $1)`;
  valores.push(incluirInactivos);

  if (region) {
    valores.push(region);
    sql += ` AND h.region = $${valores.length}`;
  }

  sql += ' ORDER BY h.activo DESC, h.region, h.nombre';

  const { rows } = await query(sql, valores);
  return rows;
}

export async function obtenerHospital(idHospital, ejecutor = { query }, { incluirInactivo = false } = {}) {
  const { rows } = await ejecutor.query(
    `SELECT ${CAMPOS} ${DESDE} WHERE h.id = $1 AND (h.activo = TRUE OR $2)`,
    [idHospital, incluirInactivo]
  );

  if (rows.length === 0) {
    throw errorNoEncontrado('Hospital no encontrado');
  }

  return rows[0];
}

const vacio = (valor) => valor === undefined || valor === null || String(valor).trim() === '';

// Telefono opcional de 10 digitos; se guarda sin espacios ni guiones
function validarTelefono(valor) {
  if (vacio(valor)) return null;
  const digitos = String(valor).replace(/[\s()-]/g, '');
  if (!/^\d{10}$/.test(digitos)) {
    throw errorValidacion('telefono debe tener 10 dígitos');
  }
  return digitos;
}

function validarClues(valor) {
  if (vacio(valor)) return null;
  const clues = String(valor).trim().toUpperCase();
  if (!REGEX_CLUES.test(clues)) {
    throw errorValidacion('clues debe tener 11 caracteres: BS, 3 letras y 6 dígitos (por ejemplo BSIMS000013)');
  }
  return clues;
}


function columnasHospital(datos, parcial) {
  const enviado = (campo) => !parcial || datos[campo] !== undefined;
  const columnas = {};
  if (enviado('nombre')) columnas.nombre = textoObligatorio(datos.nombre, 'nombre', 3, 200);
  if (enviado('institucion')) {
    if (!INSTITUCIONES.includes(datos.institucion)) {
      throw errorValidacion('institucion debe ser una de: ' + INSTITUCIONES.join(', '));
    }
    columnas.institucion = datos.institucion;
  }
  if (enviado('id_municipio')) columnas.id_municipio = parsearId(datos.id_municipio, 'id_municipio');
  if (enviado('direccion')) columnas.direccion = textoObligatorio(datos.direccion, 'direccion', 10, 300);
  if (enviado('telefono')) columnas.telefono = validarTelefono(datos.telefono);
  if (enviado('clues')) columnas.clues = validarClues(datos.clues);
  if (enviado('latitud') || enviado('longitud')) Object.assign(columnas, validarPuntoBcs(datos.latitud, datos.longitud));
  return columnas;
}

function traducirDuplicado(error) {
  if (error.code === '23505') {
    return errorValidacion('Esa CLUES ya está registrada en otro hospital');
  }
  return error;
}

async function verificarNombreLibre(client, idMunicipio, nombre, municipio, idPropio = null) {
  const repetido = await client.query(
    'SELECT 1 FROM hospitales WHERE id_municipio = $1 AND lower(nombre) = lower($2) AND id IS DISTINCT FROM $3',
    [idMunicipio, nombre, idPropio]
  );
  if (repetido.rows.length > 0) {
    throw errorValidacion('Ya existe un hospital llamado ' + nombre + ' en ' + municipio);
  }
}

// Solo admin. La region sale del municipio para que no se contradigan
export async function crearHospital(datos, contexto = {}) {
  const columnas = columnasHospital(datos, false);

  try {
    return await transaccion(async (client) => {
      const municipio = await municipioActivo(columnas.id_municipio, client);
      await verificarNombreLibre(client, columnas.id_municipio, columnas.nombre, municipio.nombre);

      const { rows } = await client.query(`
        INSERT INTO hospitales (nombre, institucion, clues, id_municipio, region, direccion, telefono, latitud, longitud)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [columnas.nombre, columnas.institucion, columnas.clues, columnas.id_municipio, municipio.region,
        columnas.direccion, columnas.telefono, columnas.latitud, columnas.longitud]);

      await registrarLog(client, {
        idUsuario: contexto.idUsuario,
        accion: 'HOSPITAL_CREADO',
        detalles: { id_hospital: rows[0].id, nombre: columnas.nombre, municipio: municipio.nombre, region: municipio.region },
        ipOrigen: contexto.ip
      });

      console.log('[HOSPITALES] Hospital creado, id_hospital=' + rows[0].id);
      return obtenerHospital(rows[0].id, client);
    });
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

// Solo admin. Corrige datos de un hospital, activo o no; si cambia el municipio, cambia la region
export async function editarHospital(idHospital, datos, contexto = {}) {
  const columnas = columnasHospital(datos, true);
  if (Object.keys(columnas).length === 0) {
    throw errorValidacion('No hay campos para actualizar');
  }

  try {
    return await transaccion(async (client) => {
      const actual = await obtenerHospital(idHospital, client, { incluirInactivo: true });
      const idMunicipio = columnas.id_municipio ?? actual.id_municipio;
      if (!idMunicipio) {
        throw errorValidacion('id_municipio es obligatorio: este hospital aún no tiene municipio');
      }
      const municipio = await municipioActivo(idMunicipio, client);
      columnas.region = municipio.region;
      await verificarNombreLibre(client, idMunicipio, columnas.nombre ?? actual.nombre, municipio.nombre, idHospital);

      const cambiados = Object.keys(columnas).filter((campo) => columnas[campo] !== actual[campo]);
      if (cambiados.length === 0) return actual;

      const asignaciones = cambiados.map((campo, i) => campo + ' = $' + (i + 2));
      await client.query(
        `UPDATE hospitales SET ${asignaciones.join(', ')} WHERE id = $1`,
        [idHospital, ...cambiados.map((campo) => columnas[campo])]
      );

      await registrarLog(client, {
        idUsuario: contexto.idUsuario,
        accion: 'HOSPITAL_EDITADO',
        detalles: { id_hospital: idHospital, campos: cambiados },
        ipOrigen: contexto.ip
      });

      console.log('[HOSPITALES] Hospital editado, id_hospital=' + idHospital);
      return obtenerHospital(idHospital, client, { incluirInactivo: true });
    });
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

// Solo admin. Desactivar un hospital con solicitudes activas mandaria donantes a un hospital fuera de servicio,
// y sus cuentas se desactivan con el para que nadie siga operando a su nombre. Al reactivarlo las cuentas
// se reactivan una por una en Usuarios
export async function cambiarActivoHospital(idHospital, activo, contexto = {}) {
  if (typeof activo !== 'boolean') {
    throw errorValidacion('activo debe ser true o false');
  }

  return transaccion(async (client) => {
    const actual = await obtenerHospital(idHospital, client, { incluirInactivo: true });
    if (actual.activo === activo) return { hospital: actual, cuentasDesactivadas: 0 };

    let cuentasDesactivadas = 0;
    if (!activo) {
      const { rows } = await client.query(
        "SELECT COUNT(*)::int AS total FROM solicitudes WHERE id_hospital = $1 AND estado = 'activa'",
        [idHospital]
      );
      if (rows[0].total > 0) {
        throw new ErrorHttp(409, 'El hospital tiene ' + rows[0].total + (rows[0].total === 1 ? ' solicitud activa' : ' solicitudes activas') + ': ciérralas antes de desactivarlo');
      }
      const cuentas = await client.query(
        'UPDATE usuarios SET activo = FALSE WHERE id_hospital = $1 AND activo = TRUE',
        [idHospital]
      );
      cuentasDesactivadas = cuentas.rowCount;
    }

    await client.query('UPDATE hospitales SET activo = $2 WHERE id = $1', [idHospital, activo]);

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: activo ? 'HOSPITAL_ACTIVADO' : 'HOSPITAL_DESACTIVADO',
      detalles: activo ? { id_hospital: idHospital } : { id_hospital: idHospital, cuentas_desactivadas: cuentasDesactivadas },
      ipOrigen: contexto.ip
    });

    console.log('[HOSPITALES] Hospital ' + (activo ? 'activado' : 'desactivado') + ', id_hospital=' + idHospital);
    return { hospital: await obtenerHospital(idHospital, client, { incluirInactivo: true }), cuentasDesactivadas };
  });
}
