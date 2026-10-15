import { Router } from 'express';
import {
  postNotificar,
  patchResponder,
  getMisNotificaciones,
  patchDonacion
} from './notificaciones.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

// Hospital dueno de la solicitud o admin (el dueno se valida en el service)
router.post('/notificar', verificarToken, soloRol('hospital', 'admin'), postNotificar);
router.patch('/:id/donacion', verificarToken, soloRol('hospital', 'admin'), patchDonacion);

// Donante
router.get('/mis-notificaciones', verificarToken, soloRol('donante'), getMisNotificaciones);
router.patch('/:id/responder', verificarToken, soloRol('donante'), patchResponder);

export default router;
