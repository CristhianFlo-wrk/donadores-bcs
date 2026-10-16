import { Router } from 'express';
import { registrar, iniciarSesion, perfil, postUsuario, getUsuarios, patchActivo } from './auth.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';
import { limitarIntentosLogin } from '../../middleware/limiteIntentos.js';

const router = Router();

router.post('/registro', registrar);
router.post('/login', limitarIntentosLogin, iniciarSesion);
router.get('/perfil', verificarToken, perfil);

// Gestion de cuentas de hospital y admin
router.get('/usuarios', verificarToken, soloRol('admin'), getUsuarios);
router.post('/usuarios', verificarToken, soloRol('admin'), postUsuario);
router.patch('/usuarios/:id/activo', verificarToken, soloRol('admin'), patchActivo);

export default router;
