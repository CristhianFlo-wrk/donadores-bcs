import { query, transaccion } from '../../config/database.js';
import { descifrar, cifrar } from '../../utils/crypto.js';
import { errorValidacion, errorNoEncontrado, parsearId } from '../../utils/errores.js';
import { resolverColonia } from '../ubicaciones/ubicaciones.service.js';
import { validarPeso, validarCoordenadas } from './donantes.validaciones.js';
import { registrarLog } from '../auditoria/auditoria.service.js';

export const DIAS_ENTRE_DONACIONES = 90;

// Obtiene el perfil del donante con datos descifrados
export async function obtenerPerfil(idUsuario) {
  const { rows } = await query(`
    SELECT d.*, u.email,
           ts.codigo AS tipo_sangre_codigo,
           ts.grupo AS tipo_sangre_grupo,
           ts.rh AS tipo_sangre_rh,
           c.nombre AS colonia_nombre,
           m.nombre AS municipio_nombre
    FROM donantes d
    JOIN usuarios u ON d.id_usuario = u.id
    JOIN tipos_sangre ts ON d.id_tipo_sangre = ts.id
    LEFT JOIN colonias c ON d.id_colonia = c.id
    LEFT JOIN municipios m ON c.id_municipio = m.id
    WHERE d.id_usuario = $1
  `, [idUsuario]);

  const donante = rows[0];
  if (!donante) {
    throw errorNoEncontrado('Perfil de donante no encontrado');
  }

  return {
    id: donante.id,
    email: donante.email,
    nombre_completo: descifrar(donante.nombre_cifrado),
    telefono: descifrar(donante.telefono_cifrado),
    fecha_nacimiento: donante.fecha_nacimiento,
    sexo: donante.sexo,
    tipo_sangre: donante.tipo_sangre_codigo,
    tipo_sangre_grupo: donante.tipo_sangre_grupo,
    tipo_sangre_rh: donante.tipo_sangre_rh,
    ubicacion: {
      id_colonia: donante.id_colonia,
      colonia: donante.colonia_personalizada || donante.colonia_nombre,
      municipio: donante.municipio_nombre,
      region: donante.region,
      latitud: donante.latitud,
      longitud: donante.longitud
    },
    disponible: donante.disponible,
    peso_kg: donante.peso_kg,
    ha_donado_antes: donante.ha_donado_antes,
    ultima_donacion: donante.ultima_donacion,
    created_at: donante.created_at
  };
}

// Actualiza solo los campos enviados; la colonia se revalida y recalcula la region
export async function actualizarPerfil(idUsuario, cambios, contexto = {}) {
  const campos = [];
  const valores = [];
  const agregar = (columna, valor) => {
    valores.push(valor);
    campos.push(`${columna} = $${valores.length}`);
  };

  if (cambios.nombre_completo !== undefined) {
    if (!cambios.nombre_completo || !String(cambios.nombre_completo).trim()) {
      throw errorValidacion('nombre_completo no puede estar vacío');
    }
    agregar('nombre_cifrado', cifrar(String(cambios.nombre_completo).trim()));
  }

  if (cambios.telefono !== undefined) {
    agregar('telefono_cifrado', cifrar(cambios.telefono));
  }

  if (cambios.peso_kg !== undefined) {
    if (cambios.peso_kg === null) throw errorValidacion('peso_kg no puede ser null');
    validarPeso(cambios.peso_kg);
    agregar('peso_kg', cambios.peso_kg);
  }

  validarCoordenadas(cambios.latitud, cambios.longitud);
  if (cambios.latitud !== undefined) agregar('latitud', cambios.latitud);
  if (cambios.longitud !== undefined) agregar('longitud', cambios.longitud);

  if (cambios.colonia_personalizada !== undefined && cambios.id_colonia === undefined) {
    throw errorValidacion('Para cambiar colonia_personalizada envía también id_colonia');
  }

  await transaccion(async (client) => {
    if (cambios.id_colonia !== undefined) {
      parsearId(cambios.id_colonia, 'id_colonia');
      const colonia = await resolverColonia(cambios.id_colonia, cambios.colonia_personalizada, client);
      agregar('id_colonia', colonia.idColonia);
      agregar('colonia_personalizada', colonia.coloniaPersonalizada);
      agregar('region', colonia.region);
    }

    if (cambios.id_tipo_sangre !== undefined) {
      parsearId(cambios.id_tipo_sangre, 'id_tipo_sangre');
      const tipo = await client.query('SELECT id FROM tipos_sangre WHERE id = $1', [cambios.id_tipo_sangre]);
      if (tipo.rows.length === 0) {
        throw errorValidacion('Tipo de sangre inválido');
      }
      agregar('id_tipo_sangre', cambios.id_tipo_sangre);
    }

    if (campos.length === 0) {
      throw errorValidacion('No hay campos para actualizar');
    }

    valores.push(idUsuario);
    const resultado = await client.query(
      `UPDATE donantes SET ${campos.join(', ')} WHERE id_usuario = $${valores.length}`,
      valores
    );

    if (resultado.rowCount === 0) {
      throw errorNoEncontrado('Perfil de donante no encontrado');
    }

    // Solo nombres de columnas, nunca los valores (datos personales)
    const columnas = campos.map((campo) => campo.split(' = ')[0]);
    await registrarLog(client, {
      idUsuario,
      accion: 'PERFIL_ACTUALIZADO',
      detalles: { campos: columnas },
      ipOrigen: contexto.ip
    });
  });

  return obtenerPerfil(idUsuario);
}

export async function cambiarDisponibilidad(idUsuario, disponible, contexto = {}) {
  return transaccion(async (client) => {
    const { rows } = await client.query(`
      UPDATE donantes SET disponible = $1
      WHERE id_usuario = $2
      RETURNING disponible
    `, [disponible, idUsuario]);

    if (rows.length === 0) {
      throw errorNoEncontrado('Perfil de donante no encontrado');
    }

    await registrarLog(client, {
      idUsuario,
      accion: 'DISPONIBILIDAD_CAMBIADA',
      detalles: { disponible: rows[0].disponible },
      ipOrigen: contexto.ip
    });

    return { disponible: rows[0].disponible };
  });
}

export async function actualizarFcmToken(idUsuario, fcmToken) {
  if (fcmToken !== null && (typeof fcmToken !== 'string' || !fcmToken.trim() || fcmToken.length > 4096)) {
    throw errorValidacion('fcm_token debe ser un texto no vacío de hasta 4096 caracteres o null');
  }

  const { rowCount } = await query(
    'UPDATE donantes SET fcm_token = $1 WHERE id_usuario = $2',
    [fcmToken === null ? null : fcmToken.trim(), idUsuario]
  );
  if (rowCount === 0) {
    throw errorNoEncontrado('Perfil de donante no encontrado');
  }

  return { push_activo: fcmToken !== null };
}

// Donantes compatibles con un tipo de sangre receptor, para hospitales y admin
// Solo devuelve datos no identificables: sin nombre, CURP, telefono ni coordenadas exactas
export async function buscarCompatibles(idTipoReceptor, filtros = {}) {
  const { region = null, soloDisponibles = true, soloAptos = true, excluirSolicitud = null, limite = 50 } = filtros;

  const receptor = await query('SELECT id FROM tipos_sangre WHERE id = $1', [idTipoReceptor]);
  if (receptor.rows.length === 0) {
    throw errorNoEncontrado('Tipo de sangre no encontrado');
  }

  const valores = [idTipoReceptor];
  let sql = `
    SELECT d.id AS id_donante,
           ts.codigo AS tipo_sangre,
           ts.es_donante_universal,
           d.region,
           m.nombre AS municipio,
           d.disponible,
           d.ultima_donacion
    FROM donantes d
    JOIN usuarios u ON d.id_usuario = u.id
    JOIN tipos_sangre ts ON d.id_tipo_sangre = ts.id
    JOIN compatibilidad_sanguinea cs ON cs.id_donante = d.id_tipo_sangre
    LEFT JOIN colonias c ON d.id_colonia = c.id
    LEFT JOIN municipios m ON c.id_municipio = m.id
    WHERE cs.id_receptor = $1 AND u.activo = TRUE
  `;

  if (soloDisponibles) {
    sql += ' AND d.disponible = TRUE';
  }

  // Regla de intervalo minimo entre donaciones
  if (soloAptos) {
    sql += ` AND (d.ultima_donacion IS NULL OR d.ultima_donacion <= NOW() - INTERVAL '${DIAS_ENTRE_DONACIONES} days')`;
  }

  if (region) {
    valores.push(region);
    sql += ` AND d.region = $${valores.length}`;
  }

  if (excluirSolicitud) {
    valores.push(excluirSolicitud);
    sql += ` AND NOT EXISTS (SELECT 1 FROM notificaciones n WHERE n.id_solicitud = $${valores.length} AND n.id_donante = d.id)`;
  }

  valores.push(limite);
  sql += ` ORDER BY ts.es_donante_universal DESC, d.created_at DESC LIMIT $${valores.length}`;

  const { rows } = await query(sql, valores);
  return rows;
}

export function sinIdDonante(donantes) {
  return donantes.map(({ id_donante: idDonante, ...resto }) => resto);
}

// Estadisticas del donante a partir de historial_donaciones
export async function obtenerStats(idUsuario) {
  // Los dias se calculan con el reloj de PostgreSQL, el mismo que usa el filtro de buscarCompatibles
  const { rows } = await query(`
    SELECT id, curp_hash, ultima_donacion,
           FLOOR(EXTRACT(EPOCH FROM (NOW() - ultima_donacion)) / 86400)::int AS dias_desde_ultima
    FROM donantes
    WHERE id_usuario = $1
  `, [idUsuario]);

  const donante = rows[0];
  if (!donante) {
    throw errorNoEncontrado('Perfil de donante no encontrado');
  }

  const { rows: porRegion } = await query(`
    SELECT region, COUNT(*) AS total
    FROM historial_donaciones
    WHERE id_donante_hash = $1
    GROUP BY region
    ORDER BY region
  `, [donante.curp_hash]);

  const totalDonaciones = porRegion.reduce((suma, fila) => suma + fila.total, 0);

  const diasDesdeUltima = donante.dias_desde_ultima;

  return {
    total_donaciones: totalDonaciones,
    donaciones_por_region: porRegion,
    ultima_donacion: donante.ultima_donacion,
    dias_desde_ultima: diasDesdeUltima,
    puede_donar: diasDesdeUltima === null || diasDesdeUltima >= DIAS_ENTRE_DONACIONES,
    dias_para_poder_donar: diasDesdeUltima === null ? 0 : Math.max(0, DIAS_ENTRE_DONACIONES - diasDesdeUltima)
  };
}
