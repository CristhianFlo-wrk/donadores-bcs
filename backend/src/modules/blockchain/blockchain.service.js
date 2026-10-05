import { generarHashBloque, HASH_GENESIS } from '../../utils/hash.js';
import { propagarBloque } from './sync.service.js';

export async function registrarBloque(db, nodo, datos) {
  const { idDonanteHash, grupoSanguineo, idHospital } = datos;

  const ultimo = db.prepare(`
    SELECT hash_actual FROM historial_blockchain
    WHERE id_donante_hash = ?
    ORDER BY id DESC LIMIT 1
  `).get(idDonanteHash);

  const hashAnterior = ultimo ? ultimo.hash_actual : HASH_GENESIS;

  const datosBloque = {
    idDonanteHash,
    fechaDonacion: new Date().toISOString(),
    grupoSanguineo,
    idHospital,
    idNodo: nodo.id
  };

  const hashActual = generarHashBloque(datosBloque, hashAnterior);

  const stmt = db.prepare(`
    INSERT INTO historial_blockchain
    (id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, id_nodo,
     hash_anterior, hash_actual)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    idDonanteHash,
    datosBloque.fechaDonacion,
    grupoSanguineo,
    idHospital,
    nodo.id,
    hashAnterior,
    hashActual
  );

  const bloque = { id: result.lastInsertRowid, ...datosBloque, hashAnterior, hashActual };

  propagarBloque(bloque, nodo.id).catch(err => console.error('Error sync:', err.message));

  return bloque;
}

export function verificarCadena(db, idDonanteHash) {
  const bloques = db.prepare(`
    SELECT * FROM historial_blockchain
    WHERE id_donante_hash = ?
    ORDER BY id ASC
  `).all(idDonanteHash);

  if (bloques.length === 0) {
    return { integra: true, total: 0, mensaje: 'Sin donaciones registradas' };
  }

  let hashEsperado = HASH_GENESIS;

  for (const bloque of bloques) {
    if (bloque.hash_anterior !== hashEsperado) {
      return { integra: false, total: bloques.length, bloqueRoto: bloque.id, mensaje: 'Cadena alterada' };
    }

    const datos = {
      idDonanteHash: bloque.id_donante_hash,
      fechaDonacion: bloque.fecha_donacion,
      grupoSanguineo: bloque.grupo_sanguineo,
      idHospital: bloque.id_hospital,
      idNodo: bloque.id_nodo
    };

    const hashCalculado = generarHashBloque(datos, hashEsperado);

    if (hashCalculado !== bloque.hash_actual) {
      return { integra: false, total: bloques.length, bloqueRoto: bloque.id, mensaje: 'Hash no coincide' };
    }

    hashEsperado = bloque.hash_actual;
  }

  return { integra: true, total: bloques.length, ultimoHash: hashEsperado, mensaje: 'Cadena verificada' };
}

export function obtenerHistorial(db, idDonanteHash) {
  return db.prepare(`
    SELECT h.*, ho.nombre as hospital_nombre
    FROM historial_blockchain h
    JOIN hospitales ho ON h.id_hospital = ho.id
    WHERE h.id_donante_hash = ?
    ORDER BY h.id ASC
  `).all(idDonanteHash);
}