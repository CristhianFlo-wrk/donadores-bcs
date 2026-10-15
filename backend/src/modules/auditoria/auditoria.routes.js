import { Router } from 'express';
import { miHistorial, verificar, historial, estado } from './auditoria.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

router.get('/mi-historial', verificarToken, soloRol('donante'), miHistorial);
router.get('/verificar/:hashDonante', verificarToken, soloRol('admin'), verificar);
router.get('/historial/:hashDonante', verificarToken, soloRol('admin'), historial);
router.get('/estado', verificarToken, soloRol('admin'), estado);

export default router;
