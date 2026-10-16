// Error con status HTTP. El manejador global de index.js responde con ese status y el mensaje
export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

export const errorValidacion = (mensaje) => new ErrorHttp(400, mensaje);
export const errorNoEncontrado = (mensaje) => new ErrorHttp(404, mensaje);

// Codigos de PostgreSQL que indican un dato mal formado enviado por el cliente:
const CODIGOS_DATO_INVALIDO = ['22P02', '22003', '22007', '22008'];

export function esDatoInvalidoPg(error) {
  return CODIGOS_DATO_INVALIDO.includes(error.code);
}

// Convierte un parametro de ruta o query a entero positivo, o lanza 400
export function parsearId(valor, nombre = 'id') {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw errorValidacion(nombre + ' debe ser un entero positivo');
  }
  return numero;
}

// Limite de resultados para listados
export function parsearLimite(valor, { defecto = 50, maximo = 100 } = {}) {
  if (valor === undefined || valor === null || valor === '') return defecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw errorValidacion('limite debe ser un entero positivo');
  }
  return Math.min(numero, maximo);
}
