import { Router } from 'express';
import {
  postSolicitud,
  getSolicitud,
  getSolicitudes,
  getCandidatos,
  patchCerrar
} from './solicitudes.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

// Cualquier usuario autenticado puede ver solicitudes (los donantes ven las activas)
router.get('/', verificarToken, getSolicitudes);
router.get('/:id', verificarToken, getSolicitud);

// hospital dueno de la solicitud o admin (el dueno se valida en el controller)
router.post('/', verificarToken, soloRol('hospital', 'admin'), postSolicitud);
router.get('/:id/candidatos', verificarToken, soloRol('hospital', 'admin'), getCandidatos);
router.patch('/:id/cerrar', verificarToken, soloRol('hospital', 'admin'), patchCerrar);

export default router;
