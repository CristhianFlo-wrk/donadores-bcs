import { Router } from 'express';
import { registrar, iniciarSesion, perfil } from './auth.controller.js';
import { verificarToken } from '../../middleware/auth.js';

const router = Router();

router.post('/registro', registrar);
router.post('/login', iniciarSesion);
router.get('/perfil', verificarToken, perfil);

export default router;