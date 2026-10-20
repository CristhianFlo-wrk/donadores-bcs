export const NOMBRES_REGION = {
  norte: 'Región Norte',
  centro: 'Región Centro',
  sur: 'Región Sur'
};

export const COLOR_REGION = {
  norte: 'bg-blue-500',
  centro: 'bg-emerald-500',
  sur: 'bg-amber-500'
};

export function nombreRegion(region) {
  return NOMBRES_REGION[region] || region || '';
}

const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoFechaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function fecha(valor) {
  return valor ? formatoFecha.format(new Date(valor)) : '';
}

export function fechaCorta(valor) {
  return valor ? formatoFechaCorta.format(new Date(valor)) : '';
}

export function fechaHora(valor) {
  return valor ? formatoFechaHora.format(new Date(valor)) : '';
}

// "Hace 5 min", "Hace 2 horas", "Hace 3 dias"; despues de una semana muestra la fecha
export function hace(valor) {
  if (!valor) return '';
  const segundos = Math.max(0, (Date.now() - new Date(valor).getTime()) / 1000);
  if (segundos < 60) return 'Hace un momento';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return 'Hace ' + minutos + ' min';
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return 'Hace ' + horas + (horas === 1 ? ' hora' : ' horas');
  const dias = Math.floor(horas / 24);
  if (dias < 7) return 'Hace ' + dias + (dias === 1 ? ' día' : ' días');
  return fechaCorta(valor);
}

export function hashCorto(hash) {
  return hash ? hash.slice(0, 12) + '...' + hash.slice(-8) : '';
}

// Codigo que el donante muestra en el hospital; es el id de su notificacion
export function codigoAsistencia(idNotificacion) {
  return 'N-' + String(idNotificacion).padStart(4, '0');
}

// Folio legible para mostrar, derivado del id y el anio de la fecha
export function folio(id, fechaValor) {
  const anio = fechaValor ? new Date(fechaValor).getFullYear() : '';
  return '#BCS-' + anio + '-' + String(id).padStart(3, '0');
}
