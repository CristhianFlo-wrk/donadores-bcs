import { Router } from 'express';
import {
  getMunicipios,
  getColoniasPorMunicipio,
  getTiposSangre
} from './ubicaciones.controller.js';

const router = Router();

router.get('/municipios', getMunicipios);
router.get('/colonias/:idMunicipio', getColoniasPorMunicipio);
router.get('/tipos-sangre', getTiposSangre);

export default router;