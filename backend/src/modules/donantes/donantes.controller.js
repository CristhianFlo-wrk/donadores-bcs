import {
  obtenerPerfil,
  actualizarPerfil,
  cambiarDisponibilidad,
  buscarCompatibles,
  obtenerStats
} from './donantes.service.js';

export function getPerfil(req, res) {
  try {
    const perfil = obtenerPerfil(req.db, req.usuario.id);
    if (!perfil) {
      return res.status(404).json({ ok: false, error: 'Perfil no encontrado' });
    }
    res.json({ ok: true, perfil });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function putPerfil(req, res) {
  try {
    const perfil = actualizarPerfil(req.db, req.usuario.id, req.body);
    res.json({ ok: true, perfil });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export function patchDisponibilidad(req, res) {
  try {
    const { disponible } = req.body;
    if (typeof disponible !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'Campo "disponible" debe ser boolean' });
    }
    const resultado = cambiarDisponibilidad(req.db, req.usuario.id, disponible);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export function getCompatibles(req, res) {
  try {
    const { idTipoSangre } = req.params;
    const filtros = {
      idNodo: req.query.nodo || null,
      soloDisponibles: req.query.soloDisponibles !== 'false',
      limite: parseInt(req.query.limite) || 50
    };

    const donantes = buscarCompatibles(req.db, idTipoSangre, filtros);
    res.json({ ok: true, total: donantes.length, donantes });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function getStats(req, res) {
  try {
    const stats = obtenerStats(req.db, req.usuario.id);
    res.json({ ok: true, stats });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}