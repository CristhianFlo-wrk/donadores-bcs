import { errorValidacion } from './errores.js';

export const IMAGENES_MAXIMAS = 3;
export const BYTES_MAXIMOS_IMAGEN = 600 * 1024;

const MARCADORES_QUITADOS = new Set([0xe1, 0xed, 0xfe]);

// Devuelve el JPEG sin esos bloques, o null si no es un JPEG bien formado.
export function limpiarJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const partes = [buffer.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buffer.length) {
    if (buffer[i] !== 0xff) return null;
    const marcador = buffer[i + 1];
    // Bytes de relleno entre bloques
    if (marcador === 0xff) {
      i += 1;
      continue;
    }
    if (marcador === 0xda) {
      partes.push(buffer.subarray(i));
      return Buffer.concat(partes);
    }
    const largo = buffer.readUInt16BE(i + 2);
    if (largo < 2 || i + 2 + largo > buffer.length) return null;
    if (!MARCADORES_QUITADOS.has(marcador)) partes.push(buffer.subarray(i, i + 2 + largo));
    i += 2 + largo;
  }
  return null;
}

export function decodificarImagenes(lista) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) {
    throw errorValidacion('imagenes debe ser una lista');
  }
  if (lista.length > IMAGENES_MAXIMAS) {
    throw errorValidacion('Se admiten como máximo ' + IMAGENES_MAXIMAS + ' imágenes');
  }

  return lista.map((imagen, indice) => {
    const coincide = typeof imagen === 'string' && imagen.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!coincide) {
      throw errorValidacion('La imagen ' + (indice + 1) + ' debe ser una foto JPEG');
    }
    if (coincide[1].length * 0.75 > BYTES_MAXIMOS_IMAGEN) {
      throw errorValidacion('La imagen ' + (indice + 1) + ' pesa más de ' + BYTES_MAXIMOS_IMAGEN / 1024 + ' KB');
    }
    const limpia = limpiarJpeg(Buffer.from(coincide[1], 'base64'));
    if (!limpia) {
      throw errorValidacion('La imagen ' + (indice + 1) + ' no es un JPEG válido');
    }
    return limpia;
  });
}
