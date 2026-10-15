import { listarHospitales, obtenerHospital } from './hospitales.service.js';
import { getRegion } from '../../config/regiones.js';
import { parsearId, errorValidacion } from '../../utils/errores.js';

export async function getHospitales(req, res) {
  const { region } = req.query;
  if (region && !getRegion(region)) {
    throw errorValidacion('region debe ser norte, centro o sur');
  }

  const hospitales = await listarHospitales({ region });
  res.json({ ok: true, total: hospitales.length, hospitales });
}

export async function getHospitalPorId(req, res) {
  const hospital = await obtenerHospital(parsearId(req.params.id));
  res.json({ ok: true, hospital });
}
