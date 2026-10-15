import { Router } from 'express';
import { verificar, historial, estado } from './auditoria.controller.js';

const router = Router();

router.get('/verificar/:hashDonante', verificar);
router.get('/historial/:hashDonante', historial);
router.get('/estado', estado);

export default router;
