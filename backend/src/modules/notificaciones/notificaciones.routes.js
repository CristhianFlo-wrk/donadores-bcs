import { Router } from 'express';
import {
  postNotificar,
  patchResponder,
  getMisNotificaciones
} from './notificaciones.controller.js';
import { verificarToken } from '../../middleware/auth.js';

const router = Router();

router.post('/notificar', verificarToken, postNotificar);
router.patch('/:id/responder', verificarToken, patchResponder);
router.get('/mis-notificaciones', verificarToken, getMisNotificaciones);

export default router;