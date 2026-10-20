import { Navigate, Outlet, useLocation } from 'react-router';
import { rutaInicioPorRol, useSesion } from '../contexto/SesionContext.jsx';
import { Cargando } from './ui.jsx';

export default function RutaProtegida({ roles }) {
  const { usuario, cargando } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <Cargando texto="Verificando sesión..." />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  if (!roles.includes(usuario.rol)) return <Navigate to={rutaInicioPorRol(usuario.rol)} replace />;

  return <Outlet />;
}
