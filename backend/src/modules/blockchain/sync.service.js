import axios from 'axios';
import { getOtrosNodos, getNodo } from '../../config/nodos.js';
import { generarHashBloque } from '../../utils/hash.js';

export async function propagarBloque(bloque, nodoOrigen) {
  const destinos = getOtrosNodos(nodoOrigen);

  const resultados = await Promise.allSettled(
    destinos.map(nodo =>
      axios.post(`${nodo.url}/api/blockchain/recibir`, { bloque, nodoOrigen }, { timeout: 5000 })
    )
  );

  const exitosos = resultados.filter(r => r.status === 'fulfilled').length;
  console.log(`📡 Propagación desde ${nodoOrigen}: ${exitosos}/${destinos.length}`);

  return { exitosos, total: destinos.length };
}

export function recibirBloque(db, bloque, nodoOrigen) {
  const ultimoLocal = db.prepare(`
    SELECT hash_actual FROM historial_blockchain
    WHERE id_donante_hash = ? ORDER BY id DESC LIMIT 1
  `).get(bloque.idDonanteHash);

  const hashEsperado = ultimoLocal ? ultimoLocal.hash_actual : '0'.repeat(64);

  if (bloque.hashAnterior !== hashEsperado) {
    return { aceptado: false, razon: 'Hash anterior no coincide' };
  }

  const hashCalculado = generarHashBloque(
    {
      idDonanteHash: bloque.idDonanteHash,
      fechaDonacion: bloque.fechaDonacion,
      grupoSanguineo: bloque.grupoSanguineo,
      idHospital: bloque.idHospital,
      idNodo: bloque.idNodo
    },
    bloque.hashAnterior
  );

  if (hashCalculado !== bloque.hashActual) {
    return { aceptado: false, razon: 'Hash actual inválido' };
  }

  const existente = db.prepare(
    `SELECT id FROM historial_blockchain WHERE hash_actual = ?`
  ).get(bloque.hashActual);

  if (existente) return { aceptado: false, razon: 'Bloque ya existe' };

  db.prepare(`
    INSERT INTO historial_blockchain
    (id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, id_nodo,
     hash_anterior, hash_actual, origen_replicacion, recibido_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bloque.idDonanteHash,
    bloque.fechaDonacion,
    bloque.grupoSanguineo,
    bloque.idHospital,
    bloque.idNodo,
    bloque.hashAnterior,
    bloque.hashActual,
    nodoOrigen,
    new Date().toISOString()
  );

  return { aceptado: true };
}

export async function sincronizarConNodo(db, nodoLocal, nodoDestinoId) {
  const nodoDestino = getNodo(nodoDestinoId);
  if (!nodoDestino) throw new Error('Nodo no encontrado');

  const estadoRemoto = await axios.get(`${nodoDestino.url}/api/blockchain/estado`);
  const hashRemoto = estadoRemoto.data.ultimoHash;

  const estadoLocal = db.prepare(
    `SELECT hash_actual FROM historial_blockchain ORDER BY id DESC LIMIT 1`
  ).get();
  const hashLocal = estadoLocal ? estadoLocal.hash_actual : '0'.repeat(64);

  if (hashLocal === hashRemoto) {
    return { sincronizado: true, bloquesNuevos: 0, mensaje: 'Ya sincronizado' };
  }

  const faltantes = await axios.get(`${nodoDestino.url}/api/blockchain/faltantes/${hashLocal}`);

  let aplicados = 0;
  for (const bloque of faltantes.data.bloques) {
    const resultado = recibirBloque(db, bloque, nodoDestinoId);
    if (resultado.aceptado) aplicados++;
  }

  return { sincronizado: true, bloquesNuevos: aplicados, nodo: nodoDestinoId };
}