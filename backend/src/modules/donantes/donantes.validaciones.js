import { errorValidacion } from '../../utils/errores.js';

export const PESO_MINIMO_KG = 50;
export const PESO_MAXIMO_KG = 300;

// Validaciones de datos del donante compartidas por auth y donantes 
export function validarPeso(pesoKg) {
  if (pesoKg === undefined || pesoKg === null) return;
  const peso = Number(pesoKg);
  if (!Number.isFinite(peso) || peso < PESO_MINIMO_KG) {
    throw errorValidacion('El peso mínimo para donar es 50 kg');
  }
  if (peso > PESO_MAXIMO_KG) {
    throw errorValidacion('peso_kg fuera de rango');
  }
}

export function validarCoordenadas(latitud, longitud) {
  if (latitud !== undefined && latitud !== null) {
    const lat = Number(latitud);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw errorValidacion('latitud debe estar entre -90 y 90');
    }
  }
  if (longitud !== undefined && longitud !== null) {
    const lon = Number(longitud);
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw errorValidacion('longitud debe estar entre -180 y 180');
    }
  }
}
