// Controlador de ubicaciones: municipios, colonias y tipos de sangre
import {
  listarMunicipios, listarColoniasPorMunicipio, listarTiposSangre, crearColonia, editarColonia, cambiarActivoColonia
} from './ubicaciones.service.js';
import { contextoDe } from '../auditoria/auditoria.service.js';
import { parsearId } from '../../utils/errores.js';

export async function getMunicipios(req, res) {
  const municipios = await listarMunicipios();
  res.json({ ok: true, total: municipios.length, municipios });
}

// Ruta publica: las colonias inactivas son solo nombres de un catalogo, no hay nada privado que esconder
export async function getColoniasPorMunicipio(req, res) {
  const idMunicipio = parsearId(req.params.idMunicipio, 'idMunicipio');
  const incluirInactivas = req.query.incluir_inactivas === 'true';
  const { municipio, colonias } = await listarColoniasPorMunicipio(idMunicipio, { incluirInactivas });
  res.json({ ok: true, municipio, total: colonias.length, colonias });
}

export async function postColonia(req, res) {
  const colonia = await crearColonia(req.body || {}, contextoDe(req));
  res.status(201).json({ ok: true, colonia });
}

export async function patchColonia(req, res) {
  const colonia = await editarColonia(parsearId(req.params.id), req.body || {}, contextoDe(req));
  res.json({ ok: true, colonia });
}

export async function patchActivoColonia(req, res) {
  const colonia = await cambiarActivoColonia(parsearId(req.params.id), req.body?.activo, contextoDe(req));
  res.json({ ok: true, colonia });
}

export async function getTiposSangre(req, res) {
  const tipos = await listarTiposSangre();
  res.json({ ok: true, total: tipos.length, tipos });
}
