import { Router } from 'express';
import {
  getMunicipios,
  getColoniasPorMunicipio,
  postColonia,
  patchColonia,
  patchActivoColonia,
  getTiposSangre
} from './ubicaciones.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';

const router = Router();

router.get('/municipios', getMunicipios);
router.get('/colonias/:idMunicipio', getColoniasPorMunicipio);
router.post('/colonias', verificarToken, soloRol('admin'), postColonia);
router.patch('/colonias/:id', verificarToken, soloRol('admin'), patchColonia);
router.patch('/colonias/:id/activo', verificarToken, soloRol('admin'), patchActivoColonia);
router.get('/tipos-sangre', getTiposSangre);

export default router;
