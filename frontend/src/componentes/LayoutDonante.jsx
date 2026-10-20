import { Outlet } from 'react-router';
import { Bell, BookOpen, House, ShieldCheck, User } from 'lucide-react';
import { useSesion } from '../contexto/SesionContext.jsx';
import { notificaciones } from '../api/servicios.js';
import { useConsulta } from '../hooks/useConsulta.js';
import MarcoApp from './MarcoApp.jsx';

export default function LayoutDonante() {
  const { usuario, cerrarSesion } = useSesion();

  // Contador de alertas pendientes, se refresca cada 30s mientras la pestana este visible
  const consulta = useConsulta(() => notificaciones.mias(), [], { intervaloMs: 30000 });
  const pendientes = (consulta.datos?.notificaciones || []).filter(
    (n) => n.estado === 'enviada' && n.solicitud_estado === 'activa'
  ).length;

  const secciones = [
    { ruta: '/donante', texto: 'Inicio', Icono: House, exacta: true },
    { ruta: '/donante/alertas', texto: 'Alertas', Icono: Bell, contador: { valor: pendientes, etiqueta: 'alertas sin responder' } },
    { ruta: '/donante/historial', texto: 'Historial', Icono: ShieldCheck },
    { ruta: '/donante/antes-de-donar', texto: 'Antes de donar', textoCorto: 'Guía', Icono: BookOpen },
    { ruta: '/donante/perfil', texto: 'Perfil', Icono: User }
  ];

  return (
    <MarcoApp tono="rojo" alcance="Portal del donante" secciones={secciones} correo={usuario.email} alSalir={cerrarSesion}>
      <Outlet context={{ recargarAlertas: consulta.recargar }} />
    </MarcoApp>
  );
}
