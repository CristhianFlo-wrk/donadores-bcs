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

router.post('/', verificarToken, postSolicitud);
router.get('/', verificarToken, getSolicitudes);
router.get('/:id', verificarToken, getSolicitud);
router.get('/:id/candidatos', verificarToken, getCandidatos);
router.patch('/:id/cerrar', verificarToken, patchCerrar);

export default router;