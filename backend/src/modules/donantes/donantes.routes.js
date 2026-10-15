import { Router } from 'express';
import {
  getPerfil,
  putPerfil,
  patchDisponibilidad,
  getCompatibles,
  getStats
} from './donantes.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

// Rutas del propio donante
router.get('/perfil', verificarToken, soloRol('donante'), getPerfil);
router.put('/perfil', verificarToken, soloRol('donante'), putPerfil);
router.patch('/disponibilidad', verificarToken, soloRol('donante'), patchDisponibilidad);
router.get('/stats', verificarToken, soloRol('donante'), getStats);

// Busqueda de compatibles para hospitales y admin
router.get('/compatibles/:idTipoSangre', verificarToken, soloRol('hospital', 'admin'), getCompatibles);

export default router;
