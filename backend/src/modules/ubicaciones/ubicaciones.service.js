import { query, transaccion } from '../../config/database.js';
import { registrarLog } from '../auditoria/auditoria.service.js';
import { errorNoEncontrado, errorValidacion, parsearId } from '../../utils/errores.js';

const NOMBRE_COLONIA_OTRA = 'Otra';

const REGEX_CODIGO_POSTAL_BCS = /^23\d{3}$/;
const LIMITES_BCS = { latitud: [22.8, 28.1], longitud: [-115.3, -109.3] };

// Texto obligatorio recortado con largo minimo y maximo
export function textoObligatorio(valor, nombre, minimo, maximo) {
  const texto = typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
  if (texto.length < minimo || texto.length > maximo) {
    throw errorValidacion(nombre + ' debe tener entre ' + minimo + ' y ' + maximo + ' caracteres');
  }
  return texto;
}

// Coordenadas opcionales: las dos o ninguna, y dentro del estado 
export function validarPuntoBcs(latitud, longitud) {
  const vacio = (v) => v === undefined || v === null || v === '';
  if (vacio(latitud) && vacio(longitud)) return { latitud: null, longitud: null };
  const punto = { latitud: Number(latitud), longitud: Number(longitud) };
  if (vacio(latitud) || vacio(longitud)) {
    throw errorValidacion('Escribe latitud y longitud, o deja las dos vacías');
  }
  for (const [eje, [minimo, maximo]] of Object.entries(LIMITES_BCS)) {
    if (!Number.isFinite(punto[eje]) || punto[eje] < minimo || punto[eje] > maximo) {
      throw errorValidacion('Las coordenadas quedan fuera de Baja California Sur (' + eje + ' entre ' + minimo + ' y ' + maximo + ')');
    }
  }
  return punto;
}

export async function municipioActivo(idMunicipio, ejecutor = { query }) {
  const { rows } = await ejecutor.query('SELECT id, nombre, region FROM municipios WHERE id = $1 AND activo = TRUE', [idMunicipio]);
  if (rows.length === 0) {
    throw errorValidacion('Municipio no encontrado');
  }
  return rows[0];
}

// Valida la regla de colonias y devuelve la region derivada de colonia segun su municipio
// colonia_personalizada solo se acepta cuando se elige la colonia "Otra" del municipio
export async function resolverColonia(idColonia, coloniaPersonalizada, ejecutor = { query }) {
  const texto = coloniaPersonalizada ? String(coloniaPersonalizada).trim() : null;

  const { rows } = await ejecutor.query(`
    SELECT c.id, c.nombre, m.region
    FROM colonias c
    JOIN municipios m ON c.id_municipio = m.id
    WHERE c.id = $1 AND c.activo = TRUE
  `, [idColonia]);

  if (rows.length === 0) {
    throw errorValidacion('Colonia no encontrada');
  }

  const esOtra = rows[0].nombre === NOMBRE_COLONIA_OTRA;
  if (esOtra && !texto) {
    throw errorValidacion('Si eliges la colonia "Otra" debes escribir colonia_personalizada');
  }
  if (!esOtra && texto) {
    throw errorValidacion('colonia_personalizada solo aplica cuando eliges la colonia "Otra"');
  }

  return { idColonia: rows[0].id, coloniaPersonalizada: esOtra ? texto : null, region: rows[0].region };
}

export async function listarMunicipios() {
  const { rows } = await query(`
    SELECT id, nombre, region, latitud, longitud
    FROM municipios
    WHERE activo = TRUE
    ORDER BY nombre ASC
  `);
  return rows;
}

// incluirInactivas: el admin las ve para reactivarlas; el registro de donantes solo recibe las activas
export async function listarColoniasPorMunicipio(idMunicipio, { incluirInactivas = false } = {}) {
  const { rows: municipios } = await query(
    'SELECT id, nombre FROM municipios WHERE id = $1 AND activo = TRUE',
    [idMunicipio]
  );

  if (municipios.length === 0) {
    throw errorNoEncontrado('Municipio no encontrado');
  }

  const { rows: colonias } = await query(`
    SELECT id, nombre, codigo_postal, latitud, longitud, activo
    FROM colonias
    WHERE id_municipio = $1 AND (activo = TRUE OR $2)
    ORDER BY nombre ASC
  `, [idMunicipio, incluirInactivas]);

  return { municipio: municipios[0].nombre, colonias };
}

function columnasColonia(datos, parcial) {
  const enviado = (campo) => !parcial || datos[campo] !== undefined;
  const columnas = {};
  if (enviado('nombre')) {
    columnas.nombre = textoObligatorio(datos.nombre, 'nombre', 2, 150);
    if (columnas.nombre.toLowerCase() === NOMBRE_COLONIA_OTRA.toLowerCase()) {
      throw errorValidacion('El nombre "Otra" está reservado');
    }
  }
  if (enviado('codigo_postal')) {
    columnas.codigo_postal = String(datos.codigo_postal ?? '').trim();
    if (!REGEX_CODIGO_POSTAL_BCS.test(columnas.codigo_postal)) {
      throw errorValidacion('codigo_postal debe tener 5 dígitos y empezar con 23 (Baja California Sur)');
    }
  }
  if (enviado('latitud') || enviado('longitud')) Object.assign(columnas, validarPuntoBcs(datos.latitud, datos.longitud));
  return columnas;
}

async function verificarColoniaLibre(client, idMunicipio, nombre, municipio, idPropia = null) {
  const repetida = await client.query(
    'SELECT 1 FROM colonias WHERE id_municipio = $1 AND lower(nombre) = lower($2) AND id IS DISTINCT FROM $3',
    [idMunicipio, nombre, idPropia]
  );
  if (repetida.rows.length > 0) {
    throw errorValidacion('La colonia ' + nombre + ' ya existe en ' + municipio);
  }
}

const CAMPOS_COLONIA = 'c.id, c.id_municipio, m.nombre AS municipio, c.nombre, c.codigo_postal, c.latitud, c.longitud, c.activo';

async function coloniaEditable(client, idColonia) {
  const { rows } = await client.query(
    `SELECT ${CAMPOS_COLONIA} FROM colonias c JOIN municipios m ON m.id = c.id_municipio WHERE c.id = $1`,
    [idColonia]
  );
  if (rows.length === 0) {
    throw errorNoEncontrado('Colonia no encontrada');
  }
  if (rows[0].nombre === NOMBRE_COLONIA_OTRA) {
    throw errorValidacion('La colonia "Otra" no se puede modificar');
  }
  return rows[0];
}

// Solo admin. La colonia "Otra" ya existe en cada municipio y su nombre queda reservado
export async function crearColonia(datos, contexto = {}) {
  const idMunicipio = parsearId(datos.id_municipio, 'id_municipio');
  const { nombre, codigo_postal: codigoPostal, latitud, longitud } = columnasColonia(datos, false);

  return transaccion(async (client) => {
    const municipio = await municipioActivo(idMunicipio, client);
    await verificarColoniaLibre(client, idMunicipio, nombre, municipio.nombre);

    const { rows } = await client.query(`
      INSERT INTO colonias (id_municipio, nombre, codigo_postal, latitud, longitud)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, id_municipio, nombre, codigo_postal, latitud, longitud, activo
    `, [idMunicipio, nombre, codigoPostal, latitud, longitud]);

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'COLONIA_CREADA',
      detalles: { id_colonia: rows[0].id, nombre, municipio: municipio.nombre, codigo_postal: codigoPostal },
      ipOrigen: contexto.ip
    });

    console.log('[UBICACIONES] Colonia creada, id_colonia=' + rows[0].id);
    return rows[0];
  });
}

// Solo admin. No cambia de municipio: la region de los donantes que ya viven ahi saldria del municipio anterior
export async function editarColonia(idColonia, datos, contexto = {}) {
  if (datos.id_municipio !== undefined) {
    throw errorValidacion('Una colonia no cambia de municipio: desactívala y créala en el correcto');
  }
  const columnas = columnasColonia(datos, true);
  if (Object.keys(columnas).length === 0) {
    throw errorValidacion('No hay campos para actualizar');
  }

  return transaccion(async (client) => {
    const actual = await coloniaEditable(client, idColonia);
    if (columnas.nombre) await verificarColoniaLibre(client, actual.id_municipio, columnas.nombre, actual.municipio, idColonia);

    const cambiados = Object.keys(columnas).filter((campo) => columnas[campo] !== actual[campo]);
    if (cambiados.length === 0) return actual;

    const asignaciones = cambiados.map((campo, i) => campo + ' = $' + (i + 2));
    await client.query(
      `UPDATE colonias SET ${asignaciones.join(', ')} WHERE id = $1`,
      [idColonia, ...cambiados.map((campo) => columnas[campo])]
    );

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: 'COLONIA_EDITADA',
      detalles: { id_colonia: idColonia, campos: cambiados },
      ipOrigen: contexto.ip
    });

    console.log('[UBICACIONES] Colonia editada, id_colonia=' + idColonia);
    return coloniaEditable(client, idColonia);
  });
}

// Solo admin. Una colonia inactiva ya no sale en el registro; los donantes que viven ahi la conservan
export async function cambiarActivoColonia(idColonia, activo, contexto = {}) {
  if (typeof activo !== 'boolean') {
    throw errorValidacion('activo debe ser true o false');
  }

  return transaccion(async (client) => {
    const actual = await coloniaEditable(client, idColonia);
    if (actual.activo === activo) return actual;

    await client.query('UPDATE colonias SET activo = $2 WHERE id = $1', [idColonia, activo]);
    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: activo ? 'COLONIA_ACTIVADA' : 'COLONIA_DESACTIVADA',
      detalles: { id_colonia: idColonia, nombre: actual.nombre, municipio: actual.municipio },
      ipOrigen: contexto.ip
    });

    console.log('[UBICACIONES] Colonia ' + (activo ? 'activada' : 'desactivada') + ', id_colonia=' + idColonia);
    return { ...actual, activo };
  });
}

export async function listarTiposSangre() {
  const { rows } = await query(`
    SELECT id, codigo, grupo, rh, descripcion,
           es_donante_universal, es_receptor_universal
    FROM tipos_sangre
    ORDER BY id ASC
  `);
  return rows;
}
