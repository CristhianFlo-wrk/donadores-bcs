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

// Rutas para donantes autenticados
router.get('/perfil', verificarToken, getPerfil);
router.put('/perfil', verificarToken, putPerfil);
router.patch('/disponibilidad', verificarToken, patchDisponibilidad);
router.get('/stats', verificarToken, getStats);

// Ruta para hospitales por busqueda compatible 
router.get('/compatibles/:idTipoSangre', verificarToken, getCompatibles);

export default router;