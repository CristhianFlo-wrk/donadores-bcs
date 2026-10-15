import { query } from '../../config/database.js';
import { errorNoEncontrado, errorValidacion } from '../../utils/errores.js';

const NOMBRE_COLONIA_OTRA = 'Otra';

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

export async function listarColoniasPorMunicipio(idMunicipio) {
  const { rows: municipios } = await query(
    'SELECT id, nombre FROM municipios WHERE id = $1 AND activo = TRUE',
    [idMunicipio]
  );

  if (municipios.length === 0) {
    throw errorNoEncontrado('Municipio no encontrado');
  }

  const { rows: colonias } = await query(`
    SELECT id, nombre, codigo_postal, latitud, longitud
    FROM colonias
    WHERE id_municipio = $1 AND activo = TRUE
    ORDER BY nombre ASC
  `, [idMunicipio]);

  return { municipio: municipios[0].nombre, colonias };
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
