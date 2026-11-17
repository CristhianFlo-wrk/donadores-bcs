import { Router } from 'express';
import { getHospitales, getHospitalPorId, postHospital, patchHospital, patchActivoHospital } from './hospitales.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, getHospitales);
router.post('/', verificarToken, soloRol('admin'), postHospital);
router.get('/:id', verificarToken, getHospitalPorId);
router.patch('/:id', verificarToken, soloRol('admin'), patchHospital);
router.patch('/:id/activo', verificarToken, soloRol('admin'), patchActivoHospital);

export default router;
