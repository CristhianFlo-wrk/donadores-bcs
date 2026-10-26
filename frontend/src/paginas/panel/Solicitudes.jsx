import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { BarraProgreso, EncabezadoPagina, EnlaceBoton, EstadoConsulta, FichaSangre, Pestanas, Punto, Vacio } from '../../componentes/ui.jsx';
import { BadgeEstadoSolicitud, BadgeUrgencia } from '../../componentes/insignias.jsx';
import { COLOR_REGION, fechaHora, nombreRegion } from '../../utils/formato.js';

const FILTROS = [
  { valor: 'activa', texto: 'Activas' },
  { valor: 'completada', texto: 'Completadas' },
  { valor: 'cancelada', texto: 'Canceladas' },
  { valor: '', texto: 'Todas' }
];

export default function Solicitudes() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const esAdmin = usuario.rol === 'admin';
  const base = esAdmin ? '/admin' : '/hospital';
  const [estado, setEstado] = useState('activa');

  // Un hospital solo ve las solicitudes que emitio
  const consulta = useConsulta(
    () => solicitudes.listar({ estado, id_hospital: esAdmin ? null : usuario.id_hospital }),
    [estado],
    { intervaloMs: 30000 }
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Solicitudes"
        descripcion={esAdmin ? 'Solicitudes de todos los hospitales del estado.' : 'Solicitudes emitidas por tu hospital.'}
        acciones={
          <EnlaceBoton to={base + '/solicitudes/nueva'} className="w-full sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            Nueva solicitud
          </EnlaceBoton>
        }
      />

      <Pestanas opciones={FILTROS} valor={estado} alCambiar={setEstado} etiqueta="Filtrar por estado" />

      <div className="mt-4">
        <EstadoConsulta consulta={consulta}>
          {({ solicitudes: lista }) => lista.length === 0 ? (
            <Vacio titulo="No hay solicitudes con este filtro" />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white">
              <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-600">
                {lista.length} {lista.length === 1 ? 'solicitud' : 'solicitudes'}
              </p>
              <ul className="divide-y divide-gray-100 xl:hidden">
                {lista.map((s) => (
                  <li key={s.id}>
                    <Link to={base + '/solicitudes/' + s.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50">
                      <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="line-clamp-2 text-sm font-semibold text-gray-900">{esAdmin ? s.hospital_nombre : 'Solicitud #' + s.id}</span>
                          <BadgeEstadoSolicitud estado={s.estado} />
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                          <BadgeUrgencia urgencia={s.urgencia} />
                          <span className="inline-flex items-center gap-1.5"><Punto color={COLOR_REGION[s.region]} />{nombreRegion(s.region)}</span>
                          · {fechaHora(s.fecha_solicitud)}
                        </span>
                        <span className="mt-2 flex items-center gap-3">
                          <BarraProgreso valor={s.unidades_donadas} maximo={s.unidades_requeridas} etiqueta={'Unidades de la solicitud ' + s.id} className="flex-1" />
                          <span className="whitespace-nowrap text-xs tabular-nums text-gray-700"><span className="font-semibold text-gray-900">{s.unidades_donadas}</span> de {s.unidades_requeridas}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden xl:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-gray-600">
                      <th className="px-5 py-2.5 font-medium">Tipo</th>
                      <th className="px-3 py-2.5 font-medium">{esAdmin ? 'Hospital' : 'Solicitud'}</th>
                      <th className="px-3 py-2.5 font-medium">Prioridad</th>
                      <th className="w-48 px-3 py-2.5 font-medium 2xl:w-64">Unidades</th>
                      <th className="px-3 py-2.5 font-medium">Región</th>
                      <th className="px-3 py-2.5 font-medium">Fecha</th>
                      <th className="px-5 py-2.5 text-right font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                    {lista.map((s) => (
                      <tr key={s.id} onClick={() => navegar(base + '/solicitudes/' + s.id)} className="cursor-pointer transition-colors hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <Link to={base + '/solicitudes/' + s.id} onClick={(e) => e.stopPropagation()} aria-label={'Ver solicitud ' + s.id}>
                            <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                          </Link>
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900">{esAdmin ? s.hospital_nombre : '#' + s.id}</td>
                        <td className="px-3 py-3"><BadgeUrgencia urgencia={s.urgencia} /></td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-3">
                            <BarraProgreso valor={s.unidades_donadas} maximo={s.unidades_requeridas} etiqueta={'Unidades de la solicitud ' + s.id} className="min-w-12 flex-1" />
                            <span className="w-14 whitespace-nowrap text-right tabular-nums text-gray-800"><span className="font-semibold text-gray-900">{s.unidades_donadas}</span> de {s.unidades_requeridas}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                          <span className="inline-flex items-center gap-1.5"><Punto color={COLOR_REGION[s.region]} />{nombreRegion(s.region)}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-700">{fechaHora(s.fecha_solicitud)}</td>
                        <td className="px-5 py-3 text-right"><BadgeEstadoSolicitud estado={s.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </EstadoConsulta>
      </div>
    </>
  );
}
