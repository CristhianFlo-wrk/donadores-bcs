import { query } from '../../config/database.js';
import { errorNoEncontrado } from '../../utils/errores.js';

const CAMPOS = 'id, nombre, institucion, region, direccion, telefono, latitud, longitud';

export async function listarHospitales({ region } = {}) {
  const valores = [];
  let sql = `SELECT ${CAMPOS} FROM hospitales WHERE activo = TRUE`;

  if (region) {
    valores.push(region);
    sql += ` AND region = $${valores.length}`;
  }

  sql += ' ORDER BY region, nombre';

  const { rows } = await query(sql, valores);
  return rows;
}

export async function obtenerHospital(idHospital) {
  const { rows } = await query(
    `SELECT ${CAMPOS} FROM hospitales WHERE id = $1 AND activo = TRUE`,
    [idHospital]
  );

  if (rows.length === 0) {
    throw errorNoEncontrado('Hospital no encontrado');
  }

  return rows[0];
}
