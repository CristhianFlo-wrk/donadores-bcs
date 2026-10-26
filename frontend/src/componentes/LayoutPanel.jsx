import { Outlet } from 'react-router';
import { ClipboardList, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import { useSesion } from '../contexto/SesionContext.jsx';
import { hospitales } from '../api/servicios.js';
import { useConsulta } from '../hooks/useConsulta.js';
import MarcoApp from './MarcoApp.jsx';

const SECCIONES = {
  hospital: [
    { ruta: '/hospital', texto: 'Resumen', Icono: LayoutDashboard, exacta: true },
    { ruta: '/hospital/solicitudes', texto: 'Solicitudes', Icono: ClipboardList }
  ],
  admin: [
    { ruta: '/admin', texto: 'Resumen', Icono: LayoutDashboard, exacta: true },
    { ruta: '/admin/solicitudes', texto: 'Solicitudes', Icono: ClipboardList },
    { ruta: '/admin/usuarios', texto: 'Usuarios', Icono: Users },
    { ruta: '/admin/auditoria', texto: 'Auditoría', Icono: ShieldCheck }
  ]
};

// Panel web para hospital y admin. El hospital ve el nombre de su hospital como alcance
export default function LayoutPanel() {
  const { usuario, cerrarSesion } = useSesion();
  const esHospital = usuario.rol === 'hospital';
  const consultaHospital = useConsulta(
    () => (esHospital ? hospitales.obtener(usuario.id_hospital) : Promise.resolve(null)),
    [usuario.id_hospital]
  );

  const alcance = esHospital ? consultaHospital.datos?.hospital?.nombre || 'Panel hospitalario' : 'Administración estatal';

  return (
    <MarcoApp tono="azul" alcance={alcance} secciones={SECCIONES[usuario.rol]} correo={usuario.email} alSalir={cerrarSesion}>
      <Outlet />
    </MarcoApp>
  );
}
