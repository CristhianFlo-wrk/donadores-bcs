import { verificarHistorial, obtenerHistorialDonante, obtenerEstado } from './auditoria.service.js';

export function verificar(req, res) {
  try {
    const resultado = verificarHistorial(req.db, req.params.hashDonante);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function historial(req, res) {
  try {
    const entradas = obtenerHistorialDonante(req.db, req.params.hashDonante);
    res.json({ ok: true, total: entradas.length, entradas });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function estado(req, res) {
  try {
    const resultado = obtenerEstado(req.db);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
