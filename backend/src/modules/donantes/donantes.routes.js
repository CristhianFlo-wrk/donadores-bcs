import { Router } from 'express';
import {
  getPerfil,
  putPerfil,
  patchDisponibilidad,
  getStats,
  putFcmToken
} from './donantes.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

// Rutas del propio donante
router.get('/perfil', verificarToken, soloRol('donante'), getPerfil);
router.put('/perfil', verificarToken, soloRol('donante'), putPerfil);
router.patch('/disponibilidad', verificarToken, soloRol('donante'), patchDisponibilidad);
router.get('/stats', verificarToken, soloRol('donante'), getStats);
router.put('/fcm-token', verificarToken, soloRol('donante'), putFcmToken);

export default router;
