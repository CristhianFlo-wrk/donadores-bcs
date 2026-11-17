import { Router } from 'express';
import {
  postSolicitud,
  postSolicitudCiudadana,
  getMisSolicitudes,
  getSolicitud,
  getSolicitudes,
  getCandidatos,
  patchCerrar,
  patchUrgencia,
  getImagen,
  deleteImagen,
  deleteHistoria
} from './solicitudes.controller.js';
import { verificarToken, soloRol } from '../../middleware/auth.js';
import { limitarSolicitudesCiudadanas } from '../../middleware/limiteIntentos.js';

const router = Router();

router.get('/', verificarToken, getSolicitudes);
router.get('/mias', verificarToken, soloRol('donante'), getMisSolicitudes);
router.get('/:id', verificarToken, getSolicitud);
// Fotos de una ciudadana: las ve quien puede ver la solicitud; solo el hospital dueno o admin las quitan
router.get('/:id/imagenes/:idImagen', verificarToken, getImagen);
router.delete('/:id/imagenes/:idImagen', verificarToken, soloRol('hospital', 'admin'), deleteImagen);
router.delete('/:id/historia', verificarToken, soloRol('hospital', 'admin'), deleteHistoria);

// Solicitud ciudadana: un donante pide sangre
router.post('/ciudadana', verificarToken, soloRol('donante'), limitarSolicitudesCiudadanas, postSolicitudCiudadana);

// hospital dueno de la solicitud o admin (el dueno se valida en el controller); el donante autor solo cancela
router.post('/', verificarToken, soloRol('hospital', 'admin'), postSolicitud);
router.get('/:id/candidatos', verificarToken, soloRol('hospital', 'admin'), getCandidatos);
router.patch('/:id/urgencia', verificarToken, soloRol('hospital', 'admin'), patchUrgencia);
router.patch('/:id/cerrar', verificarToken, soloRol('hospital', 'admin', 'donante'), patchCerrar);

export default router;
