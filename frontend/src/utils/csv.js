// CSV que Excel abre bien en espanol: BOM de UTF-8 para los acentos, comas y fin de linea de Windows
export function aCsv(filas) {
  return '﻿' + filas.map((fila) => fila.map(celda).join(',')).join('\r\n');
}

// Toda celda va entre comillas. Una que empieza con = + - @ lleva un apostrofo delante: Excel la ejecutaria como formula,
// y en la bitacora hay datos que escribieron los usuarios (correos, detalles)
export function celda(valor) {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = "'" + texto;
  return '"' + texto.replace(/"/g, '""') + '"';
}

export function descargarArchivo(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  // Se libera despues: algunos navegadores leen la URL un momento despues del clic
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
