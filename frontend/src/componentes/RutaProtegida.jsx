import { Navigate, Outlet, useLocation } from 'react-router';
import { WifiOff } from 'lucide-react';
import { rutaInicioPorRol, useSesion } from '../contexto/SesionContext.jsx';
import { Boton, Cargando } from './ui.jsx';

// Hay sesion guardada pero no se pudo confirmar: se ofrece reintentar en vez de mandar al login
export function SesionSinConfirmar() {
  const { verificarSesion, cerrarSesion } = useSesion();

  return (
    <div role="alert" className="tono-rojo flex min-h-dvh flex-col items-center justify-center gap-3 bg-fondo px-4 text-center">
      <WifiOff className="size-8 text-gray-500" aria-hidden="true" />
      <h1 className="font-display text-[1.5rem] font-bold leading-tight tracking-tight text-balance text-gray-900">No pudimos confirmar tu sesión</h1>
      <p className="max-w-sm text-sm text-pretty text-gray-600">Revisa tu conexión. Tu sesión sigue guardada y se recupera sola cuando vuelva la señal.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Boton onClick={verificarSesion}>Reintentar</Boton>
        <Boton variante="contorno" onClick={cerrarSesion}>Entrar con otra cuenta</Boton>
      </div>
    </div>
  );
}

export default function RutaProtegida({ roles }) {
  const { usuario, cargando, sinConexion } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <Cargando texto="Verificando sesión..." />;
  if (!usuario && sinConexion) return <SesionSinConfirmar />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  if (!roles.includes(usuario.rol)) return <Navigate to={rutaInicioPorRol(usuario.rol)} replace />;

  return <Outlet />;
}
