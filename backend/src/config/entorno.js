const VARIABLES_REQUERIDAS = ['DATABASE_URL', 'AES_KEY', 'JWT_SECRET', 'HASH_KEY'];
const REGEX_HEX_32_BYTES = /^[0-9a-fA-F]{64}$/;
const LONGITUD_MINIMA_JWT_PROD = 32;

// Devuelve la lista de problemas de configuracion; vacia si todo esta bien
export function validarEntorno(entorno) {
  const errores = [];

  const faltantes = VARIABLES_REQUERIDAS.filter((nombre) => !entorno[nombre]);
  if (faltantes.length > 0) {
    errores.push('Faltan variables de entorno: ' + faltantes.join(', '));
  }

  for (const nombre of ['AES_KEY', 'HASH_KEY']) {
    if (entorno[nombre] && !REGEX_HEX_32_BYTES.test(entorno[nombre])) {
      errores.push(nombre + ' debe tener 64 caracteres hexadecimales (32 bytes)');
    }
  }

  if (entorno.NODE_ENV === 'production') {
    if (entorno.JWT_SECRET && entorno.JWT_SECRET.length < LONGITUD_MINIMA_JWT_PROD) {
      errores.push('JWT_SECRET debe tener al menos ' + LONGITUD_MINIMA_JWT_PROD + ' caracteres en produccion');
    }
    if (!entorno.CORS_ORIGIN) {
      errores.push('CORS_ORIGIN es obligatoria en produccion (dominio del frontend)');
    }
  }

  return errores;
}
