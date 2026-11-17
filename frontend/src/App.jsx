import { Link, Navigate, Route, Routes } from 'react-router';
import { rutaInicioPorRol, useSesion } from './contexto/SesionContext.jsx';
import RutaProtegida, { SesionSinConfirmar } from './componentes/RutaProtegida.jsx';
import LayoutDonante from './componentes/LayoutDonante.jsx';
import LayoutPanel from './componentes/LayoutPanel.jsx';
import { Cargando } from './componentes/ui.jsx';
import AvisoSinConexion from './componentes/AvisoSinConexion.jsx';
import Presentacion from './paginas/publico/Presentacion.jsx';
import Login from './paginas/publico/Login.jsx';
import Registro from './paginas/publico/Registro.jsx';
import Privacidad from './paginas/publico/Privacidad.jsx';
import Inicio from './paginas/donante/Inicio.jsx';
import Alertas from './paginas/donante/Alertas.jsx';
import Historial from './paginas/donante/Historial.jsx';
import Perfil from './paginas/donante/Perfil.jsx';
import AntesDeDonar from './paginas/donante/AntesDeDonar.jsx';
import MisSolicitudes from './paginas/donante/MisSolicitudes.jsx';
import PedirSangre from './paginas/donante/PedirSangre.jsx';
import VerSolicitud from './paginas/donante/VerSolicitud.jsx';
import Resumen from './paginas/panel/Resumen.jsx';
import Solicitudes from './paginas/panel/Solicitudes.jsx';
import NuevaSolicitud from './paginas/panel/NuevaSolicitud.jsx';
import DetalleSolicitud from './paginas/panel/DetalleSolicitud.jsx';
import Usuarios from './paginas/admin/Usuarios.jsx';
import Auditoria from './paginas/admin/Auditoria.jsx';
import Constancias from './paginas/admin/Constancias.jsx';
import Catalogos from './paginas/admin/Catalogos.jsx';

function Raiz() {
  const { usuario, cargando, sinConexion } = useSesion();
  if (cargando) return <Cargando texto="Verificando sesión..." />;
  if (!usuario && sinConexion) return <SesionSinConfirmar />;
  if (!usuario) return <Presentacion />;
  return <Navigate to={rutaInicioPorRol(usuario.rol)} replace />;
}

function NoEncontrado() {
  return (
    <div className="tono-rojo flex min-h-dvh flex-col items-center justify-center gap-2 bg-fondo px-4 text-center">
      <p className="font-display text-5xl font-bold tabular-nums text-red-700">404</p>
      <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-tight text-balance text-gray-900">Esta página no existe</h1>
      <Link to="/" className="mt-2 rounded text-sm font-semibold text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Volver al inicio</Link>
    </div>
  );
}

// Las pantallas de solicitudes se comparten entre hospital y admin
function rutasSolicitudes() {
  return (
    <>
      <Route path="solicitudes" element={<Solicitudes />} />
      <Route path="solicitudes/nueva" element={<NuevaSolicitud />} />
      <Route path="solicitudes/:id" element={<DetalleSolicitud />} />
    </>
  );
}

export default function App() {
  return (
    <>
      <AvisoSinConexion />
      <Rutas />
    </>
  );
}

function Rutas() {
  return (
    <Routes>
      <Route path="/" element={<Raiz />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/privacidad" element={<Privacidad />} />

      <Route element={<RutaProtegida roles={['donante']} />}>
        <Route path="/donante" element={<LayoutDonante />}>
          <Route index element={<Inicio />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="historial" element={<Historial />} />
          <Route path="solicitudes" element={<MisSolicitudes />} />
          <Route path="solicitudes/nueva" element={<PedirSangre />} />
          <Route path="solicitud/:id" element={<VerSolicitud />} />
          <Route path="antes-de-donar" element={<AntesDeDonar />} />
          <Route path="perfil" element={<Perfil />} />
        </Route>
      </Route>

      <Route element={<RutaProtegida roles={['hospital']} />}>
        <Route path="/hospital" element={<LayoutPanel />}>
          <Route index element={<Resumen />} />
          {rutasSolicitudes()}
        </Route>
      </Route>

      <Route element={<RutaProtegida roles={['admin']} />}>
        <Route path="/admin" element={<LayoutPanel />}>
          <Route index element={<Resumen />} />
          {rutasSolicitudes()}
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="catalogos" element={<Catalogos />} />
          <Route path="auditoria" element={<Auditoria />} />
          <Route path="constancias" element={<Constancias />} />
        </Route>
      </Route>

      <Route element={<RutaProtegida roles={['auditor']} />}>
        <Route path="/auditor" element={<LayoutPanel />}>
          <Route index element={<Auditoria />} />
          <Route path="constancias" element={<Constancias />} />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  );
}
