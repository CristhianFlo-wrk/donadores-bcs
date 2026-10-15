// Controlador de ubicaciones: municipios, colonias y tipos de sangre
import { listarMunicipios, listarColoniasPorMunicipio, listarTiposSangre } from './ubicaciones.service.js';
import { parsearId } from '../../utils/errores.js';

export async function getMunicipios(req, res) {
  const municipios = await listarMunicipios();
  res.json({ ok: true, total: municipios.length, municipios });
}

export async function getColoniasPorMunicipio(req, res) {
  const idMunicipio = parsearId(req.params.idMunicipio, 'idMunicipio');
  const { municipio, colonias } = await listarColoniasPorMunicipio(idMunicipio);
  res.json({ ok: true, municipio, total: colonias.length, colonias });
}

export async function getTiposSangre(req, res) {
  const tipos = await listarTiposSangre();
  res.json({ ok: true, total: tipos.length, tipos });
}
