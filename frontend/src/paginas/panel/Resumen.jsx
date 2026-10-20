import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { hospitales, reportes, solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { BarraProgreso, Cargando, EncabezadoPagina, EnlaceBoton, EstadoConsulta, FichaSangre, Panel, TiraMetricas, Vacio } from '../../componentes/ui.jsx';
import { BadgeUrgencia } from '../../componentes/insignias.jsx';
import { fechaHora, hace } from '../../utils/formato.js';

const MAXIMO_ACTIVAS = 6;

// Resumen del hospital (sus solicitudes) o del admin (todo el estado o un hospital)
export default function Resumen() {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'admin';
  const [idHospital, setIdHospital] = useState('');
  const consulta = useConsulta(() => reportes.dashboard(esAdmin ? idHospital : null), [idHospital], { intervaloMs: 60000 });
  const consultaHospitales = useConsulta(() => (esAdmin ? hospitales.listar() : Promise.resolve(null)));
  const consultaActivas = useConsulta(
    () => solicitudes.listar({ estado: 'activa', id_hospital: esAdmin ? idHospital : usuario.id_hospital }),
    [idHospital],
    { intervaloMs: 60000 }
  );
  const base = esAdmin ? '/admin' : '/hospital';
  const listaHospitales = consultaHospitales.datos?.hospitales || [];
  const nombreAlcance = esAdmin
    ? (listaHospitales.find((h) => String(h.id) === idHospital)?.nombre || 'Todo el estado')
    : 'Tus solicitudes';

  return (
    <>
      <EncabezadoPagina
        titulo="Resumen"
        descripcion={nombreAlcance + '. Los datos de donantes son de todo el estado.'}
        acciones={
          <>
            {esAdmin && <label className="sr-only" htmlFor="filtro-hospital">Ver datos de</label>}
            {esAdmin && (
              <select
                id="filtro-hospital"
                value={idHospital}
                onChange={(e) => setIdHospital(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-acento-600 focus:outline-none focus:ring-2 focus:ring-acento-100 sm:w-72"
              >
                <option value="">Todo el estado</option>
                {listaHospitales.map((h) => <option key={h.id} value={String(h.id)}>{h.nombre}</option>)}
              </select>
            )}
            <EnlaceBoton to={base + '/solicitudes/nueva'} className="w-full sm:w-auto">
              <Plus className="size-4" aria-hidden="true" />
              Nueva solicitud
            </EnlaceBoton>
          </>
        }
      />

      <EstadoConsulta consulta={consulta}>
        {({ dashboard }) => (
          <>
            <TiraMetricas
              className="mb-6"
              metricas={[
                { etiqueta: 'Solicitudes activas', valor: dashboard.solicitudes.activas },
                { etiqueta: 'Críticas activas', valor: dashboard.solicitudes.criticas_activas, color: dashboard.solicitudes.criticas_activas > 0 ? 'text-red-700' : undefined },
                { etiqueta: 'Donaciones registradas', valor: dashboard.donaciones_registradas },
                { etiqueta: 'Donantes aptos hoy', valor: dashboard.donantes.aptos, detalle: 'de ' + dashboard.donantes.total + ' registrados en el estado' }
              ]}
            />

            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
              <div className="min-w-0 space-y-6">
                <SolicitudesActivas consulta={consultaActivas} base={base} esAdmin={esAdmin} />
                <SolicitudesAtendidas lista={dashboard.solicitudes_atendidas} base={base} esAdmin={esAdmin} />
              </div>

              <div className="space-y-6">
                <DonantesPorTipo grupos={dashboard.donantes.por_grupo_sanguineo} />
                <Panel titulo="Donantes por región" cuerpo="">
                  <dl className="grid grid-cols-3 divide-x divide-gray-100">
                    {['norte', 'centro', 'sur'].map((region) => (
                      <div key={region} className="px-4 py-4">
                        <dt className="text-sm capitalize text-gray-600">{region}</dt>
                        <dd className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                          {dashboard.donantes.por_region.find((r) => r.region === region)?.total || 0}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
                <Panel titulo="Estado de las solicitudes" cuerpo="">
                  <dl className="grid grid-cols-3 divide-x divide-gray-100">
                    {[
                      ['Completadas', dashboard.solicitudes.completadas],
                      ['Canceladas', dashboard.solicitudes.canceladas],
                      ['Totales', dashboard.solicitudes.total]
                    ].map(([etiqueta, valor]) => (
                      <div key={etiqueta} className="px-4 py-4">
                        <dt className="text-sm text-gray-600">{etiqueta}</dt>
                        <dd className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{valor}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
              </div>
            </div>
          </>
        )}
      </EstadoConsulta>
    </>
  );
}

// Lo que el hospital esta atendiendo ahora: unidades obtenidas contra las requeridas
function SolicitudesActivas({ consulta, base, esAdmin }) {
  const lista = consulta.datos?.solicitudes || [];
  const visibles = lista.slice(0, MAXIMO_ACTIVAS);

  return (
    <Panel
      titulo="Solicitudes activas"
      detalle="Unidades obtenidas contra las requeridas"
      cuerpo=""
      accion={lista.length > MAXIMO_ACTIVAS && (
        <Link to={base + '/solicitudes'} className="text-sm font-semibold text-acento-700 hover:underline">Ver las {lista.length}</Link>
      )}
    >
      {consulta.cargando ? (
        <Cargando />
      ) : visibles.length === 0 ? (
        <Vacio titulo="No hay solicitudes activas" className="m-5">Las solicitudes nuevas aparecerán aquí con su avance.</Vacio>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibles.map((s) => {
            const completa = s.unidades_donadas >= s.unidades_requeridas;
            return (
              <li key={s.id}>
                <Link
                  to={base + '/solicitudes/' + s.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-gray-50 md:grid-cols-[auto_minmax(0,1fr)_6rem_minmax(8rem,14rem)_8rem]"
                >
                  <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{esAdmin ? s.hospital_nombre : 'Solicitud #' + s.id}</span>
                    <span className="block text-xs text-gray-600">{hace(s.fecha_solicitud)}</span>
                  </span>
                  <span className="justify-self-end md:justify-self-start"><BadgeUrgencia urgencia={s.urgencia} /></span>
                  <BarraProgreso valor={s.unidades_donadas} maximo={s.unidades_requeridas} etiqueta={'Unidades obtenidas de la solicitud ' + s.id} className="col-span-3 md:col-span-1" />
                  <span className="col-span-3 whitespace-nowrap text-xs text-gray-700 md:col-span-1 md:text-right md:text-sm">
                    <span className="font-semibold tabular-nums text-gray-900">{s.unidades_donadas}</span> de <span className="tabular-nums">{s.unidades_requeridas}</span>
                    {completa ? <span className="text-emerald-700"> · completa</span> : ' unidades'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function SolicitudesAtendidas({ lista, base, esAdmin }) {
  return (
    <Panel titulo="Atendidas recientemente" cuerpo="">
      {lista.length === 0 ? (
        <Vacio titulo="Aún no hay solicitudes completadas" className="m-5" />
      ) : (
        <>
          <ul className="divide-y divide-gray-100 md:hidden">
            {lista.map((s) => (
              <li key={s.id}>
                <Link to={base + '/solicitudes/' + s.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50">
                  <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                  <span className="min-w-0 flex-1">
                    {esAdmin && <span className="block truncate text-sm font-semibold text-gray-900">{s.hospital_nombre}</span>}
                    <span className="block text-xs text-gray-600">
                      {s.total_notificados} {s.total_notificados === 1 ? 'notificado' : 'notificados'} · {s.donaciones} {s.donaciones === 1 ? 'donación' : 'donaciones'} · {fechaHora(s.fecha_cierre)}
                    </span>
                  </span>
                  <BadgeUrgencia urgencia={s.urgencia} />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-600">
                  <th className="px-5 py-2.5 font-medium">Tipo</th>
                  {esAdmin && <th className="px-3 py-2.5 font-medium">Hospital</th>}
                  <th className="px-3 py-2.5 font-medium">Prioridad</th>
                  <th className="px-3 py-2.5 text-right font-medium">Notificados</th>
                  <th className="px-3 py-2.5 text-right font-medium">Donaciones</th>
                  <th className="px-5 py-2.5 text-right font-medium">Cerrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {lista.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link to={base + '/solicitudes/' + s.id} aria-label={'Ver solicitud ' + s.id}><FichaSangre tipo={s.tipo_sangre} tamano="sm" /></Link>
                    </td>
                    {esAdmin && <td className="px-3 py-3 text-gray-800">{s.hospital_nombre}</td>}
                    <td className="px-3 py-3"><BadgeUrgencia urgencia={s.urgencia} /></td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-800">{s.total_notificados}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-800">{s.donaciones}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-gray-600">{fechaHora(s.fecha_cierre)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

// Barras de un solo color; los tipos sin ningun donante se nombran al pie
function DonantesPorTipo({ grupos }) {
  const sinDonantes = grupos.filter((g) => g.total === 0).map((g) => g.tipo_sangre);
  return (
    <Panel titulo="Donantes por tipo de sangre" detalle="Registrados en todo el estado">
      <div className="space-y-2.5">
        {grupos.map((g) => (
          <div key={g.tipo_sangre} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
            <span className="font-semibold text-gray-900">{g.tipo_sangre}</span>
            <div className="h-2 overflow-hidden rounded-full bg-acento-50" role="img" aria-label={g.tipo_sangre + ': ' + g.total + ' donantes, ' + g.porcentaje + ' por ciento'}>
              <div className="h-full rounded-full bg-acento-600" style={{ width: g.porcentaje + '%' }} />
            </div>
            <span className="text-right text-xs tabular-nums text-gray-600">{g.total} · {g.porcentaje}%</span>
          </div>
        ))}
      </div>
      <p className={'mt-4 border-t border-gray-100 pt-3 text-sm ' + (sinDonantes.length > 0 ? 'text-red-700' : 'text-gray-600')}>
        {sinDonantes.length > 0
          ? 'Sin donantes registrados: ' + sinDonantes.join(', ') + '.'
          : 'Todos los tipos tienen al menos un donante registrado.'}
      </p>
    </Panel>
  );
}

