import { Outlet } from 'react-router';
import { Building2, ClipboardList, FileCheck, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
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
    { ruta: '/admin/catalogos', texto: 'Catálogos', Icono: Building2 },
    { ruta: '/admin/auditoria', texto: 'Auditoría', Icono: ShieldCheck },
    { ruta: '/admin/constancias', texto: 'Constancias', Icono: FileCheck }
  ],
  auditor: [
    { ruta: '/auditor', texto: 'Auditoría', Icono: ShieldCheck, exacta: true },
    { ruta: '/auditor/constancias', texto: 'Constancias', Icono: FileCheck }
  ]
};

const ALCANCE = { admin: 'Administración estatal', auditor: 'Auditoría (solo lectura)' };

// Panel web para hospital, admin y auditor. El hospital ve el nombre de su hospital como alcance
export default function LayoutPanel() {
  const { usuario, cerrarSesion } = useSesion();
  const esHospital = usuario.rol === 'hospital';
  const consultaHospital = useConsulta(
    () => (esHospital ? hospitales.obtener(usuario.id_hospital) : Promise.resolve(null)),
    [usuario.id_hospital]
  );

  const alcance = esHospital ? consultaHospital.datos?.hospital?.nombre || 'Panel hospitalario' : ALCANCE[usuario.rol];

  return (
    <MarcoApp tono="azul" alcance={alcance} secciones={SECCIONES[usuario.rol]} correo={usuario.email} alSalir={cerrarSesion}>
      <Outlet />
    </MarcoApp>
  );
}
