import { descifrar, cifrar } from '../../utils/crypto.js';

//obtiene el perfil del donante 
export function obtenerPerfil(db, idUsuario) {
  const donante = db.prepare(`
    SELECT d.*, u.email,
           ts.codigo as tipo_sangre_codigo,
           ts.grupo as tipo_sangre_grupo,
           ts.rh as tipo_sangre_rh,
           c.nombre as colonia_nombre,
           m.nombre as municipio_nombre,
           m.id as municipio_id,
           m.id_nodo as municipio_nodo
    FROM donantes d
    JOIN usuarios u ON d.id_usuario = u.id
    JOIN tipos_sangre ts ON d.id_tipo_sangre = ts.id
    LEFT JOIN colonias c ON d.id_colonia = c.id
    LEFT JOIN municipios m ON c.id_municipio = m.id
    WHERE d.id_usuario = ?
  `).get(idUsuario);

  if (!donante) return null;

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
      colonia: donante.colonia_nombre || donante.colonia_personalizada,
      municipio: donante.municipio_nombre,
      id_nodo: donante.id_nodo
    },
    disponible: donante.disponible === 1,
    peso_kg: donante.peso_kg,
    ha_donado_antes: donante.ha_donado_antes === 1,
    ultima_donacion: donante.ultima_donacion,
    created_at: donante.created_at
  };
}

// actualiza el perfil del donante 
export function actualizarPerfil(db, idUsuario, cambios) {
  const actual = db.prepare(
    'SELECT id FROM donantes WHERE id_usuario = ?'
  ).get(idUsuario);

  if (!actual) throw new Error('Donante no encontrado');

  const campos = [];
  const valores = [];

  if (cambios.nombre_completo !== undefined) {
    campos.push('nombre_cifrado = ?');
    valores.push(cifrar(cambios.nombre_completo));
  }

  if (cambios.telefono !== undefined) {
    campos.push('telefono_cifrado = ?');
    valores.push(cifrar(cambios.telefono));
  }

  if (cambios.id_colonia !== undefined || cambios.colonia_personalizada !== undefined) {
    // Validar que no estén ambos
    if (cambios.id_colonia && cambios.colonia_personalizada) {
      throw new Error('Debe elegir colonia del catálogo o personalizada, no ambas');
    }
    if (cambios.id_colonia !== undefined) {
      campos.push('id_colonia = ?');
      valores.push(cambios.id_colonia);
      campos.push('colonia_personalizada = NULL');
    }
    if (cambios.colonia_personalizada !== undefined) {
      campos.push('colonia_personalizada = ?');
      valores.push(cambios.colonia_personalizada);
      campos.push('id_colonia = NULL');
    }
  }

  if (cambios.latitud !== undefined) {
    campos.push('latitud = ?');
    valores.push(cambios.latitud);
  }

  if (cambios.longitud !== undefined) {
    campos.push('longitud = ?');
    valores.push(cambios.longitud);
  }

  if (cambios.peso_kg !== undefined) {
    if (cambios.peso_kg < 50) {
      throw new Error('El peso mínimo para donar es 50 kg');
    }
    campos.push('peso_kg = ?');
    valores.push(cambios.peso_kg);
  }

  if (cambios.id_tipo_sangre !== undefined) {
    campos.push('id_tipo_sangre = ?');
    valores.push(cambios.id_tipo_sangre);
  }

  if (campos.length === 0) {
    throw new Error('No hay campos para actualizar');
  }

  valores.push(idUsuario);

  db.prepare(`
    UPDATE donantes SET ${campos.join(', ')}
    WHERE id_usuario = ?
  `).run(...valores);

  return obtenerPerfil(db, idUsuario);
}

//cambia la disponibilidad del donante 
export function cambiarDisponibilidad(db, idUsuario, disponible) {
  const result = db.prepare(`
    UPDATE donantes SET disponible = ?
    WHERE id_usuario = ?
  `).run(disponible ? 1 : 0, idUsuario);

  if (result.changes === 0) {
    throw new Error('Donante no encontrado');
  }

  return { disponible: !!disponible };
}

/**
 * Lista donantes compatibles con un tipo de sangre receptor
 * Usa la tabla compatibilidad_sanguinea
 */
export function buscarCompatibles(db, idTipoReceptor, filtros = {}) {
  const { idNodo, soloDisponibles = true, limite = 50 } = filtros;

  let query = `
    SELECT d.id, d.curp_hash,
           substr(d.nombre_cifrado, 1, 20) as nombre_parcial,
           ts.codigo as tipo_sangre,
           d.id_nodo, d.disponible,
           d.latitud, d.longitud,
           m.nombre as municipio
    FROM donantes d
    JOIN tipos_sangre ts ON d.id_tipo_sangre = ts.id
    JOIN compatibilidad_sanguinea cs ON cs.id_donante = d.id_tipo_sangre
    LEFT JOIN colonias c ON d.id_colonia = c.id
    LEFT JOIN municipios m ON c.id_municipio = m.id
    WHERE cs.id_receptor = ?
  `;

  const valores = [idTipoReceptor];

  if (soloDisponibles) {
    query += ' AND d.disponible = 1';
  }

  if (idNodo) {
    query += ' AND d.id_nodo = ?';
    valores.push(idNodo);
  }

  query += ' ORDER BY ts.es_donante_universal DESC, d.created_at DESC LIMIT ?';
  valores.push(limite);

  return db.prepare(query).all(...valores);
}

//estadisticas del donante 
export function obtenerStats(db, idUsuario) {
  const donante = db.prepare(
    'SELECT id, curp_hash, ultima_donacion FROM donantes WHERE id_usuario = ?'
  ).get(idUsuario);

  if (!donante) throw new Error('Donante no encontrado');

  const totalDonaciones = db.prepare(`
    SELECT COUNT(*) as total FROM historial_blockchain
    WHERE id_donante_hash = ?
  `).get(donante.curp_hash).total;

  const donacionesPorNodo = db.prepare(`
    SELECT id_nodo, COUNT(*) as total
    FROM historial_blockchain
    WHERE id_donante_hash = ?
    GROUP BY id_nodo
  `).all(donante.curp_hash);

  // Calcular días desde la última donación
  let diasDesdeUltima = null;
  if (donante.ultima_donacion) {
    const ultima = new Date(donante.ultima_donacion);
    const hoy = new Date();
    diasDesdeUltima = Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24));
  }

  return {
    total_donaciones: totalDonaciones,
    donaciones_por_nodo: donacionesPorNodo,
    ultima_donacion: donante.ultima_donacion,
    dias_desde_ultima: diasDesdeUltima,
    puede_donar: diasDesdeUltima === null || diasDesdeUltima >= 90
  };
}