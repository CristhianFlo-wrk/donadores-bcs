import { Router } from 'express';
import { getDashboard } from './reportes.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

router.get('/dashboard', verificarToken, soloRol('hospital', 'admin'), getDashboard);

export default router;
