// Error con status HTTP. El manejador global de index.js responde con ese status y el mensaje
export class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

export const errorValidacion = (mensaje) => new ErrorHttp(400, mensaje);
export const errorNoEncontrado = (mensaje) => new ErrorHttp(404, mensaje);

// Convierte un parametro de ruta o query a entero positivo, o lanza 400
export function parsearId(valor, nombre = 'id') {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw errorValidacion(nombre + ' debe ser un entero positivo');
  }
  return numero;
}
