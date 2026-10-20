import { useState } from 'react';
import { auth, hospitales } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { Aviso, Badge, Boton, Campo, EncabezadoPagina, EstadoConsulta, Panel, Pestanas, Selector } from '../../componentes/ui.jsx';
import { fechaCorta } from '../../utils/formato.js';

const FILTROS_ROL = [
  { valor: '', texto: 'Todos' },
  { valor: 'hospital', texto: 'Hospitales' },
  { valor: 'admin', texto: 'Administradores' },
  { valor: 'donante', texto: 'Donantes' }
];

const TONO_ROL = { admin: 'gris', hospital: 'azul', donante: 'rojo' };
const NOMBRE_ROL = { admin: 'Administrador', hospital: 'Hospital', donante: 'Donante' };

export default function Usuarios() {
  const { usuario: yo } = useSesion();
  const [rol, setRol] = useState('');
  const [aviso, setAviso] = useState(null);
  const consulta = useConsulta(() => auth.usuarios(rol), [rol]);
  const consultaHospitales = useConsulta(() => hospitales.listar());
  const nombresHospital = Object.fromEntries((consultaHospitales.datos?.hospitales || []).map((h) => [h.id, h.nombre]));

  async function cambiarActivo(usuario) {
    setAviso(null);
    try {
      await auth.cambiarActivo(usuario.id, !usuario.activo);
      await consulta.recargar();
    } catch (e) {
      setAviso({ tono: 'error', texto: e.message });
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Usuarios" descripcion="Cuentas de hospitales, administradores y donantes. Los donantes se registran por su cuenta." />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <Pestanas opciones={FILTROS_ROL} valor={rol} alCambiar={setRol} etiqueta="Filtrar por rol" />
          {aviso && <Aviso tono={aviso.tono} className="mt-4">{aviso.texto}</Aviso>}

          <div className="mt-4">
            <EstadoConsulta consulta={consulta}>
              {({ usuarios }) => (
                <div className="rounded-xl border border-gray-200 bg-white">
                  <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-600">
                    {usuarios.length} {usuarios.length === 1 ? 'cuenta' : 'cuentas'}
                  </p>
                  <ul className="divide-y divide-gray-100 md:hidden">
                    {usuarios.map((u) => (
                      <li key={u.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 break-all text-sm font-semibold text-gray-900">{u.email}</p>
                          <EstadoCuenta usuario={u} esPropia={u.id === yo.id} alCambiar={cambiarActivo} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                          <Badge tono={TONO_ROL[u.rol]}>{NOMBRE_ROL[u.rol]}</Badge>
                          {u.id_hospital && <span>{nombresHospital[u.id_hospital] || '#' + u.id_hospital}</span>}
                          <span>Alta {fechaCorta(u.created_at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-gray-600">
                          <th className="px-5 py-2.5 font-medium">Cuenta</th>
                          <th className="px-3 py-2.5 font-medium">Rol</th>
                          <th className="px-3 py-2.5 font-medium">Alta</th>
                          <th className="px-5 py-2.5 text-right font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                        {usuarios.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <span className="block font-medium text-gray-900">{u.email}</span>
                              {u.id_hospital && <span className="block text-xs text-gray-600">{nombresHospital[u.id_hospital] || 'Hospital #' + u.id_hospital}</span>}
                            </td>
                            <td className="px-3 py-3"><Badge tono={TONO_ROL[u.rol]}>{NOMBRE_ROL[u.rol]}</Badge></td>
                            <td className="whitespace-nowrap px-3 py-3 text-gray-700">{fechaCorta(u.created_at)}</td>
                            <td className="px-5 py-3 text-right">
                              <EstadoCuenta usuario={u} esPropia={u.id === yo.id} alCambiar={cambiarActivo} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </EstadoConsulta>
          </div>
        </section>

        <FormularioUsuario hospitalesLista={consultaHospitales.datos?.hospitales || []} alCrear={consulta.recargar} />
      </div>
    </>
  );
}

// Interruptor de la cuenta; la propia no se puede desactivar
function EstadoCuenta({ usuario, esPropia, alCambiar }) {
  if (esPropia) return <Badge tono="acento" className="shrink-0">Tu cuenta</Badge>;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={usuario.activo}
      onClick={() => alCambiar(usuario)}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-xs font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-acento-600"
      title={usuario.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
    >
      <span className={'relative h-5 w-9 rounded-full transition-colors ' + (usuario.activo ? 'bg-emerald-600' : 'bg-gray-300')}>
        <span className={'absolute top-0.5 size-4 rounded-full bg-white transition-[left] ' + (usuario.activo ? 'left-4.5' : 'left-0.5')} />
      </span>
      {usuario.activo ? 'Activa' : 'Inactiva'}
    </button>
  );
}

// Los donantes se registran solos; aqui solo se crean cuentas de hospital y admin
function FormularioUsuario({ hospitalesLista, alCrear }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('hospital');
  const [idHospital, setIdHospital] = useState('');
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function crear(evento) {
    evento.preventDefault();
    setAviso(null);
    if (rol === 'hospital' && !idHospital) return setAviso({ tono: 'error', texto: 'Selecciona el hospital.' });

    const datos = { email: email.trim(), password, rol };
    if (rol === 'hospital') datos.id_hospital = Number(idHospital);

    setEnviando(true);
    try {
      await auth.crearUsuario(datos);
      setAviso({ tono: 'exito', texto: 'Cuenta creada para ' + datos.email + '.' });
      setEmail('');
      setPassword('');
      await alCrear();
    } catch (e) {
      setAviso({ tono: 'error', texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel titulo="Nueva cuenta" detalle="Solo hospitales y administradores" className="xl:sticky xl:top-8">
        <form onSubmit={crear} className="space-y-4">
          <Selector
            etiqueta="Rol"
            id="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            vacio="Selecciona un rol"
            opciones={[{ valor: 'hospital', texto: 'Hospital' }, { valor: 'admin', texto: 'Administrador' }]}
          />
          {rol === 'hospital' && (
            <Selector
              etiqueta="Hospital"
              id="id_hospital"
              value={idHospital}
              onChange={(e) => setIdHospital(e.target.value)}
              opciones={hospitalesLista.map((h) => ({ valor: String(h.id), texto: h.nombre }))}
            />
          )}
          <Campo etiqueta="Correo electrónico" id="nuevo-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo etiqueta="Contraseña inicial" id="nuevo-password" type="password" autoComplete="new-password" minLength={8} required ayuda="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
          <Boton type="submit" cargando={enviando} className="w-full">Crear cuenta</Boton>
        </form>
    </Panel>
  );
}
