// Recalcula en el navegador el sello de un registro de la bitacora, sin pedirle al servidor que lo verifique.
// Misma receta que el backend (utils/hash.js y valoresHashLog): campos en orden fijo unidos con "|" y al final el sello anterior

function canonico(valor) {
  if (valor === null || valor === undefined) return '';
  const ordenar = (v) => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === 'object') return Object.keys(v).sort().reduce((obj, llave) => ({ ...obj, [llave]: ordenar(v[llave]) }), {});
    return v;
  };
  return JSON.stringify(ordenar(valor));
}

const normalizar = (valor) => (valor === null || valor === undefined ? '' : String(valor));

// La fecha llega como texto ISO con milisegundos, igual a la que entro al sello
export function textoSellado(campos, selloAnterior) {
  const valores = [campos.id_usuario, campos.accion, canonico(campos.detalles), campos.ip_hmac, campos.fecha];
  return valores.map(normalizar).join('|') + '|' + selloAnterior;
}

export async function calcularSello(campos, selloAnterior) {
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador no permite calcular el sello (requiere HTTPS)');
  const bytes = new TextEncoder().encode(textoSellado(campos, selloAnterior));
  const resumen = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export { canonico };
