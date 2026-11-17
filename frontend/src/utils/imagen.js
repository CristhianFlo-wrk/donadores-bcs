// Igual que el backend (utils/imagenes.js)
export const IMAGENES_MAXIMAS = 3;
const BYTES_MAXIMOS = 600 * 1024;
const LADO_MAXIMO = 1280;

// Reduce la foto a 1280 px y la vuelve JPEG. Redibujarla en un canvas descarta el EXIF, donde el celular guarda la ubicacion.
// Si aun pesa demasiado baja la calidad. Devuelve un data URL listo para la API
export async function prepararFoto(archivo) {
  if (!archivo.type.startsWith('image/')) {
    throw new Error(archivo.name + ' no es una imagen.');
  }
  let mapa;
  try {
    mapa = await createImageBitmap(archivo);
  } catch {
    throw new Error('No se pudo abrir ' + archivo.name + '. Prueba con una foto JPG o PNG.');
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  const contexto = lienzo.getContext('2d');
  // Fondo blanco: una imagen PNG con transparencia no queda negra en JPEG
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  contexto.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  mapa.close();

  for (const calidad of [0.82, 0.7, 0.55]) {
    const dataUrl = lienzo.toDataURL('image/jpeg', calidad);
    if ((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75 <= BYTES_MAXIMOS) return dataUrl;
  }
  throw new Error(archivo.name + ' es demasiado pesada aun reducida.');
}
