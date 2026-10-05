import { registrarBloque, verificarCadena, obtenerHistorial } from './blockchain.service.js';
import { recibirBloque, sincronizarConNodo } from './sync.service.js';

export async function registrar(req, res) {
  try {
    const bloque = await registrarBloque(req.db, req.nodo, req.body);
    res.status(201).json({ ok: true, bloque });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function recibir(req, res) {
  try {
    const { bloque, nodoOrigen } = req.body;
    const resultado = recibirBloque(req.db, bloque, nodoOrigen);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function verificar(req, res) {
  try {
    const resultado = verificarCadena(req.db, req.params.hashDonante);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function historial(req, res) {
  try {
    const bloques = obtenerHistorial(req.db, req.params.hashDonante);
    res.json({ ok: true, total: bloques.length, bloques });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function estado(req, res) {
  const ultimo = req.db.prepare(
    `SELECT hash_actual FROM historial_blockchain ORDER BY id DESC LIMIT 1`
  ).get();
  const total = req.db.prepare(`SELECT COUNT(*) as total FROM historial_blockchain`).get();

  res.json({
    nodo: req.nodo.id,
    ultimoHash: ultimo ? ultimo.hash_actual : '0'.repeat(64),
    totalBloques: total.total
  });
}

export function faltantes(req, res) {
  const { hashDesde } = req.params;

  const bloqueDesde = req.db.prepare(
    `SELECT id FROM historial_blockchain WHERE hash_actual = ?`
  ).get(hashDesde);

  let bloques;
  if (!bloqueDesde) {
    bloques = req.db.prepare(`SELECT * FROM historial_blockchain ORDER BY id ASC`).all();
  } else {
    bloques = req.db.prepare(
      `SELECT * FROM historial_blockchain WHERE id > ? ORDER BY id ASC`
    ).all(bloqueDesde.id);
  }

  res.json({
    desde: hashDesde,
    total: bloques.length,
    bloques: bloques.map(b => ({
      idDonanteHash: b.id_donante_hash,
      fechaDonacion: b.fecha_donacion,
      grupoSanguineo: b.grupo_sanguineo,
      idHospital: b.id_hospital,
      idNodo: b.id_nodo,
      hashAnterior: b.hash_anterior,
      hashActual: b.hash_actual
    }))
  });
}

export async function sincronizar(req, res) {
  try {
    const { nodoDestino } = req.body;
    const resultado = await sincronizarConNodo(req.db, req.nodo, nodoDestino);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}