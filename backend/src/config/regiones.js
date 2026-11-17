import { errorValidacion } from '../utils/errores.js';

// Los municipios de cada region viven en la tabla municipios
export const REGIONES = ['norte', 'centro', 'sur'];

export function validarRegion(region) {
  if (!region) return null;
  if (!REGIONES.includes(region)) {
    throw errorValidacion('region debe ser norte, centro o sur');
  }
  return region;
}
