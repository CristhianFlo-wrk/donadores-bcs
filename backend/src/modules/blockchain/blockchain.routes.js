import { Router } from 'express';
import {
  registrar, recibir, verificar, historial, estado, faltantes, sincronizar
} from './blockchain.controller.js';

const router = Router();

router.post('/registrar', registrar);
router.post('/recibir', recibir);
router.get('/verificar/:hashDonante', verificar);
router.get('/historial/:hashDonante', historial);
router.get('/estado', estado);
router.get('/faltantes/:hashDesde', faltantes);
router.post('/sincronizar', sincronizar);

export default router;