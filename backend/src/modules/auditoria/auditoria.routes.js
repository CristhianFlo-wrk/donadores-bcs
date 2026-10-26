import { Router } from 'express';
import { miHistorial, historialPorNotificacion, estado } from './auditoria.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

router.get('/mi-historial', verificarToken, soloRol('donante'), miHistorial);
router.get('/notificacion/:idNotificacion', verificarToken, soloRol('hospital', 'admin'), historialPorNotificacion);
router.get('/estado', verificarToken, soloRol('admin'), estado);

export default router;
