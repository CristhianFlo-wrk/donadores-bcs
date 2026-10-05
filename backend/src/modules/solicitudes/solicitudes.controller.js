import {
  crearSolicitud,
  obtenerSolicitudPorId,
  listarSolicitudes,
  buscarCandidatos,
  cerrarSolicitud
} from './solicitudes.service.js';

export function postSolicitud(req, res) {
  try {
    const { id_hospital } = req.body;
    if (!id_hospital) {
      return res.status(400).json({ ok: false, error: 'id_hospital es obligatorio' });
    }
    const solicitud = crearSolicitud(req.db, id_hospital, req.body);
    res.status(201).json({ ok: true, solicitud });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export function getSolicitud(req, res) {
  try {
    const solicitud = obtenerSolicitudPorId(req.db, req.params.id);
    if (!solicitud) {
      return res.status(404).json({ ok: false, error: 'Solicitud no encontrada' });
    }
    res.json({ ok: true, solicitud });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function getSolicitudes(req, res) {
  try {
    const filtros = {
      estado: req.query.estado || null,
      id_hospital: req.query.hospital ? parseInt(req.query.hospital) : null,
      id_nodo: req.query.nodo || null,
      limite: parseInt(req.query.limite) || 50
    };
    const solicitudes = listarSolicitudes(req.db, filtros);
    res.json({ ok: true, total: solicitudes.length, solicitudes });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function getCandidatos(req, res) {
  try {
    const filtros = {
      idNodo: req.query.nodo || null,
      limite: parseInt(req.query.limite) || 50
    };
    const resultado = buscarCandidatos(req.db, req.params.id, filtros);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export function patchCerrar(req, res) {
  try {
    const { estado } = req.body;
    if (!estado) {
      return res.status(400).json({ ok: false, error: 'Campo "estado" es obligatorio' });
    }
    const solicitud = cerrarSolicitud(req.db, req.params.id, estado);
    res.json({ ok: true, solicitud });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}