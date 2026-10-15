import { query } from '../../config/database.js';
import { errorNoEncontrado } from '../../utils/errores.js';

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
