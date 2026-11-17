import { Router } from 'express';
import { miHistorial, historialPorNotificacion, estado, bitacora, eslabon, postConstancia, comprobar } from './auditoria.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

router.get('/mi-historial', verificarToken, soloRol('donante'), miHistorial);
router.get('/notificacion/:idNotificacion', verificarToken, soloRol('hospital', 'admin'), historialPorNotificacion);
router.get('/estado', verificarToken, soloRol('admin', 'auditor'), estado);
router.get('/bitacora', verificarToken, soloRol('admin', 'auditor'), bitacora);
router.get('/bitacora/:id/eslabon', verificarToken, soloRol('admin', 'auditor'), eslabon);
router.post('/constancias', verificarToken, soloRol('admin', 'auditor'), postConstancia);
router.post('/constancias/comprobar', verificarToken, soloRol('admin', 'auditor'), comprobar);

export default router;
