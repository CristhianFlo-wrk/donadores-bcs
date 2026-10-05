import { Router } from 'express';
import { getHospitales, getHospitalPorId } from './hospitales.controller.js';
import { verificarToken } from '../../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, getHospitales);
router.get('/:id', verificarToken, getHospitalPorId);

export default router;