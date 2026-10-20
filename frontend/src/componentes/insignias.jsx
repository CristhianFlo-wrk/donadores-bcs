import { Badge } from './ui.jsx';

const URGENCIAS = {
  critica: { tono: 'rojo', texto: 'Crítica' },
  urgente: { tono: 'amarillo', texto: 'Urgente' }
};

const ESTADOS_SOLICITUD = {
  activa: { tono: 'verde', texto: 'Activa' },
  completada: { tono: 'azul', texto: 'Completada' },
  cancelada: { tono: 'gris', texto: 'Cancelada' }
};

const ESTADOS_NOTIFICACION = {
  enviada: { tono: 'amarillo', texto: 'Sin responder' },
  confirmada: { tono: 'verde', texto: 'Confirmada' },
  rechazada: { tono: 'gris', texto: 'Rechazada' },
  donada: { tono: 'azul', texto: 'Donación registrada' }
};

function Insignia({ catalogo, valor }) {
  const item = catalogo[valor] || { tono: 'gris', texto: valor };
  return <Badge tono={item.tono}>{item.texto}</Badge>;
}

export function BadgeUrgencia({ urgencia }) {
  return <Insignia catalogo={URGENCIAS} valor={urgencia} />;
}

export function BadgeEstadoSolicitud({ estado }) {
  return <Insignia catalogo={ESTADOS_SOLICITUD} valor={estado} />;
}

export function BadgeEstadoNotificacion({ estado }) {
  return <Insignia catalogo={ESTADOS_NOTIFICACION} valor={estado} />;
}
