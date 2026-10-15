import { generarHashEntrada, HASH_GENESIS } from '../../utils/hash.js';

// Uso interno: se llama desde otros servicios, nunca desde un endpoint HTTP
export async function registrarEntrada(db, region, datos) {
  const { idDonanteHash, grupoSanguineo, idHospital } = datos;

  const ultimo = db.prepare(`
    SELECT hash_actual FROM historial_donaciones
    WHERE id_donante_hash = ?
    ORDER BY id DESC LIMIT 1
  `).get(idDonanteHash);

  const hashAnterior = ultimo ? ultimo.hash_actual : HASH_GENESIS;

  const datosEntrada = {
    idDonanteHash,
    fechaDonacion: new Date().toISOString(),
    grupoSanguineo,
    idHospital,
    region
  };

  const hashActual = generarHashEntrada(datosEntrada, hashAnterior);

  const result = db.prepare(`
    INSERT INTO historial_donaciones
    (id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, region,
     hash_anterior, hash_actual)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    idDonanteHash,
    datosEntrada.fechaDonacion,
    grupoSanguineo,
    idHospital,
    region,
    hashAnterior,
    hashActual
  );

  return { id: result.lastInsertRowid, ...datosEntrada, hashAnterior, hashActual };
}

export function verificarHistorial(db, idDonanteHash) {
  const entradas = db.prepare(`
    SELECT * FROM historial_donaciones
    WHERE id_donante_hash = ?
    ORDER BY id ASC
  `).all(idDonanteHash);

  if (entradas.length === 0) {
    return { integra: true, total: 0, mensaje: 'Sin donaciones registradas' };
  }

  let hashEsperado = HASH_GENESIS;

  for (const entrada of entradas) {
    if (entrada.hash_anterior !== hashEsperado) {
      return { integra: false, total: entradas.length, entradaRota: entrada.id, mensaje: 'Cadena alterada' };
    }

    const datos = {
      idDonanteHash: entrada.id_donante_hash,
      fechaDonacion: entrada.fecha_donacion,
      grupoSanguineo: entrada.grupo_sanguineo,
      idHospital: entrada.id_hospital,
      region: entrada.region
    };

    const hashCalculado = generarHashEntrada(datos, hashEsperado);

    if (hashCalculado !== entrada.hash_actual) {
      return { integra: false, total: entradas.length, entradaRota: entrada.id, mensaje: 'Hash no coincide' };
    }

    hashEsperado = entrada.hash_actual;
  }

  return { integra: true, total: entradas.length, ultimoHash: hashEsperado, mensaje: 'Cadena verificada' };
}

export function obtenerHistorialDonante(db, idDonanteHash) {
  return db.prepare(`
    SELECT h.*, ho.nombre as hospital_nombre
    FROM historial_donaciones h
    JOIN hospitales ho ON h.id_hospital = ho.id
    WHERE h.id_donante_hash = ?
    ORDER BY h.id ASC
  `).all(idDonanteHash);
}

export function obtenerEstado(db) {
  const ultimo = db.prepare(
    'SELECT hash_actual FROM historial_donaciones ORDER BY id DESC LIMIT 1'
  ).get();
  const total = db.prepare('SELECT COUNT(*) as total FROM historial_donaciones').get();

  return {
    ultimo_hash: ultimo ? ultimo.hash_actual : HASH_GENESIS,
    total_entradas: total.total
  };
}
