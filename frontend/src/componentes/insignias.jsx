import { Badge } from './ui.jsx';

const URGENCIAS = {
  critica: { tono: 'rojo', texto: 'Crítica' },
  urgente: { tono: 'amarillo', texto: 'Urgente' },
  normal: { tono: 'gris', texto: 'Programada' }
};

const ESTADOS_SOLICITUD = {
  activa: { tono: 'verde', texto: 'Activa' },
  completada: { tono: 'azul', texto: 'Completada' },
  cancelada: { tono: 'gris', texto: 'Cancelada' },
  falsa: { tono: 'rojo', texto: 'Falsa' },
  caducada: { tono: 'gris', texto: 'Caducada' }
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

export function textoUrgencia(urgencia) {
  return URGENCIAS[urgencia]?.texto || urgencia;
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

// Solicitud pedida por un donante y, mientras el hospital no la confirme, la marca de pendiente
export function InsigniasCiudadana({ solicitud, pendiente = 'Por confirmar' }) {
  return (
    <>
      {solicitud.ciudadana && <Badge tono="azul">Ciudadana</Badge>}
      {solicitud.por_confirmar && solicitud.estado === 'activa' && <Badge tono="amarillo">{pendiente}</Badge>}
    </>
  );
}
