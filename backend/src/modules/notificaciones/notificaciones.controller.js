import {
  notificarSolicitud,
  responderNotificacion,
  listarNotificacionesDonante
} from './notificaciones.service.js';

export async function postNotificar(req, res) {
  try {
    const { id_solicitud, id_nodo, limite } = req.body;

    if (!id_solicitud) {
      return res.status(400).json({ ok: false, error: 'id_solicitud es obligatorio' });
    }

    const resultado = await notificarSolicitud(req.db, id_solicitud, {
      idNodo: id_nodo,
      limite
    });
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export function patchResponder(req, res) {
  try {
    const { respuesta } = req.body;

    if (!respuesta) {
      return res.status(400).json({ ok: false, error: 'Campo "respuesta" es obligatorio' });
    }

    const resultado = responderNotificacion(req.db, req.params.id, respuesta);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export function getMisNotificaciones(req, res) {
  try {
    const notificaciones = listarNotificacionesDonante(req.db, req.usuario.id);
    res.json({ ok: true, total: notificaciones.length, notificaciones });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}