import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, CircleAlert, Plus, SlidersHorizontal } from 'lucide-react';
import { hospitales, solicitudes, ubicaciones } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useRetraso } from '../../hooks/useRetraso.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { BarraProgreso, Boton, Campo, EncabezadoPagina, EnlaceBoton, EstadoConsulta, FichaSangre, Pestanas, Punto, Selector, Vacio } from '../../componentes/ui.jsx';
import { BadgeEstadoSolicitud, BadgeUrgencia, InsigniasCiudadana } from '../../componentes/insignias.jsx';
import { COLOR_REGION, NOMBRES_REGION, fechaHora, hace, nombreRegion } from '../../utils/formato.js';

// sin_revisar no es un estado del backend: son las activas que el hospital aun no confirma
const SIN_REVISAR = 'sin_revisar';
const FILTROS = [
  { valor: SIN_REVISAR, texto: 'Sin revisar' },
  { valor: 'activa', texto: 'Activas' },
  { valor: 'completada', texto: 'Completadas' },
  { valor: 'cancelada', texto: 'Canceladas' },
  { valor: 'falsa', texto: 'Falsas' },
  { valor: 'caducada', texto: 'Caducadas' },
  { valor: '', texto: 'Todas' }
];

export default function Solicitudes() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const esAdmin = usuario.rol === 'admin';
  const base = esAdmin ? '/admin' : '/hospital';
  const [estado, setEstado] = useState('activa');
  const [busqueda, setBusqueda] = useState(BUSQUEDA_VACIA);
  const textoRetrasado = useRetraso(busqueda.q.trim());

  // Un hospital solo ve las solicitudes que emitio; la busqueda se combina con la pestana elegida
  const parametros = {
    ...busqueda,
    q: textoRetrasado,
    estado: estado === SIN_REVISAR ? 'activa' : estado,
    id_hospital: esAdmin ? busqueda.id_hospital : usuario.id_hospital,
    region: esAdmin ? busqueda.region : ''
  };
  const consulta = useConsulta(() => solicitudes.listar(parametros), [JSON.stringify(parametros)], { intervaloMs: 30000 });
  const buscando = Object.values(busqueda).some(Boolean);
  // Las ciudadanas sin revisar se juntan arriba de todo: mientras el hospital no las confirme no se avisa a nadie
  const consultaPendientes = useConsulta(
    () => solicitudes.listar({ estado: 'activa', id_hospital: esAdmin ? null : usuario.id_hospital }),
    [],
    { intervaloMs: 30000 }
  );
  const pendientes = (consultaPendientes.datos?.solicitudes || []).filter(porConfirmar);
  const filtros = FILTROS.map((f) => (f.valor === SIN_REVISAR && pendientes.length > 0 ? { ...f, texto: 'Sin revisar (' + pendientes.length + ')' } : f));

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

      <SinRevisar lista={pendientes} base={base} esAdmin={esAdmin} />

      <BuscadorSolicitudes busqueda={busqueda} alCambiar={setBusqueda} esAdmin={esAdmin} />

      <Pestanas opciones={filtros} valor={estado} alCambiar={setEstado} etiqueta="Filtrar por estado" />

      <div className="mt-4">
        <EstadoConsulta consulta={consulta}>
          {({ solicitudes: todas }) => {
            // En la lista completa tambien se destacan y van primero
            const lista = (estado === SIN_REVISAR ? todas.filter(porConfirmar) : [...todas]).sort((a, b) => porConfirmar(b) - porConfirmar(a));
            const sinRevisar = lista.filter(porConfirmar).length;
            if (lista.length === 0 && buscando) {
              return <Vacio titulo="Ninguna solicitud coincide con la búsqueda">Revisa el número o el código, prueba otra pestaña o quita algún filtro.</Vacio>;
            }
            return lista.length === 0 ? (
              <Vacio titulo={estado === SIN_REVISAR ? 'No hay solicitudes sin revisar' : 'No hay solicitudes con este filtro'} />
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white">
                <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-600">
                  {lista.length} {lista.length === 1 ? 'solicitud' : 'solicitudes'}
                  {sinRevisar > 0 && <span className="font-medium text-amber-800"> · {sinRevisar} sin revisar</span>}
                  {todas.length === LIMITE_LISTA && ' · se muestran las primeras ' + LIMITE_LISTA + '; busca o filtra para encontrar otras'}
                </p>
                <ul className="divide-y divide-gray-100 xl:hidden">
                  {lista.map((s) => (
                    <li key={s.id}>
                      <Link to={base + '/solicitudes/' + s.id} className={'flex items-start gap-4 px-5 py-4 ' + (porConfirmar(s) ? FONDO_SIN_REVISAR : 'hover:bg-gray-50')}>
                        <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="line-clamp-2 text-sm font-semibold text-gray-900">{esAdmin ? s.hospital_nombre : 'Solicitud #' + s.id}</span>
                            <BadgeEstadoSolicitud estado={s.estado} />
                          </span>
                          {s.paciente_nombre && <span className="mt-0.5 block text-xs text-gray-700">Para {s.paciente_nombre}</span>}
                          {textoRetrasado && s.descripcion && <span className="mt-0.5 block truncate text-xs text-gray-600">{s.descripcion}</span>}
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                            <BadgeUrgencia urgencia={s.urgencia} />
                            <InsigniasCiudadana solicitud={s} pendiente="Sin revisar" />
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
                        <tr key={s.id} onClick={() => navegar(base + '/solicitudes/' + s.id)} className={'cursor-pointer transition-colors ' + (porConfirmar(s) ? FONDO_SIN_REVISAR : 'hover:bg-gray-50')}>
                          <td className="px-5 py-3">
                            <Link to={base + '/solicitudes/' + s.id} onClick={(e) => e.stopPropagation()} aria-label={'Ver solicitud ' + s.id}>
                              <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                            </Link>
                          </td>
                          <td className="px-3 py-3 font-medium text-gray-900">
                            {esAdmin ? s.hospital_nombre : '#' + s.id}
                            {s.paciente_nombre && <span className="block text-xs font-normal text-gray-600">Para {s.paciente_nombre}</span>}
                            {textoRetrasado && s.descripcion && <span className="block max-w-56 truncate text-xs font-normal text-gray-600" title={s.descripcion}>{s.descripcion}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex flex-wrap gap-1.5">
                              <BadgeUrgencia urgencia={s.urgencia} />
                              <InsigniasCiudadana solicitud={s} pendiente="Sin revisar" />
                            </span>
                          </td>
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
            );
          }}
        </EstadoConsulta>
      </div>
    </>
  );
}

// Lo que devuelve la API sin limite explicito
const LIMITE_LISTA = 50;

const BUSQUEDA_VACIA = { q: '', id_tipo_sangre: '', urgencia: '', origen: '', id_hospital: '', region: '', desde: '', hasta: '' };

const OPCIONES_URGENCIA = [
  { valor: 'critica', texto: 'Crítica' },
  { valor: 'urgente', texto: 'Urgente' },
  { valor: 'normal', texto: 'Programada' }
];

const OPCIONES_ORIGEN = [
  { valor: 'hospital', texto: 'Del hospital' },
  { valor: 'ciudadana', texto: 'Ciudadanas' }
];

const OPCIONES_REGION = Object.entries(NOMBRES_REGION).map(([valor, texto]) => ({ valor, texto }));

// Texto libre siempre a la vista; los demas filtros se pliegan para no ocupar la pantalla del celular.
// Se abren solos si alguno tiene valor
function BuscadorSolicitudes({ busqueda, alCambiar, esAdmin }) {
  const filtrosActivos = Object.entries(busqueda).filter(([llave, valor]) => llave !== 'q' && valor).length;
  const [abierto, setAbierto] = useState(filtrosActivos > 0);
  const consultaTipos = useConsulta(() => ubicaciones.tiposSangre());
  const consultaHospitales = useConsulta(() => (esAdmin ? hospitales.listar() : Promise.resolve({ hospitales: [] })), [esAdmin]);
  const opcionesTipo = (consultaTipos.datos?.tipos || []).map((t) => ({ valor: String(t.id), texto: t.codigo }));
  const opcionesHospital = (consultaHospitales.datos?.hospitales || []).map((h) => ({ valor: String(h.id), texto: h.nombre }));

  const cambiar = (cambios) => alCambiar((previa) => ({ ...previa, ...cambios }));
  // El rango nunca queda invertido: mover un extremo arrastra al otro
  const cambiarDesde = (desde) => cambiar(busqueda.hasta && desde > busqueda.hasta ? { desde, hasta: desde } : { desde });
  const cambiarHasta = (hasta) => cambiar(busqueda.desde && hasta && hasta < busqueda.desde ? { desde: hasta, hasta } : { hasta });

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5" role="search" aria-label="Buscar solicitudes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo
          etiqueta="Buscar"
          id="buscar-solicitud"
          type="search"
          placeholder={esAdmin ? 'Número, N-0000, paciente u hospital' : 'Número, N-0000 o paciente'}          className="min-w-0 flex-1"
          value={busqueda.q}
          onChange={(e) => cambiar({ q: e.target.value })}
        />
        <div className="flex gap-2">
          <Boton variante="contorno" className="flex-1 sm:flex-none" aria-expanded={abierto} aria-controls="filtros-solicitudes" onClick={() => setAbierto(!abierto)}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros{filtrosActivos > 0 ? ' (' + filtrosActivos + ')' : ''}
          </Boton>
          {Object.values(busqueda).some(Boolean) && (
            <Boton variante="neutro" className="flex-1 sm:flex-none" onClick={() => alCambiar(BUSQUEDA_VACIA)}>Limpiar</Boton>
          )}
        </div>
      </div>

      {abierto && (
        <div id="filtros-solicitudes" className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-4 border-t border-gray-100 pt-4">
          <Selector etiqueta="Tipo de sangre" id="filtro-tipo" vacio="Todos" opciones={opcionesTipo} value={busqueda.id_tipo_sangre} onChange={(e) => cambiar({ id_tipo_sangre: e.target.value })} />
          <Selector etiqueta="Prioridad" id="filtro-urgencia" vacio="Todas" opciones={OPCIONES_URGENCIA} value={busqueda.urgencia} onChange={(e) => cambiar({ urgencia: e.target.value })} />
          <Selector etiqueta="Origen" id="filtro-origen" vacio="Todas" opciones={OPCIONES_ORIGEN} value={busqueda.origen} onChange={(e) => cambiar({ origen: e.target.value })} />
          {esAdmin && (
            <>
              <Selector etiqueta="Hospital" id="filtro-hospital-solicitud" vacio="Todos" opciones={opcionesHospital} value={busqueda.id_hospital} onChange={(e) => cambiar({ id_hospital: e.target.value })} />
              <Selector etiqueta="Región" id="filtro-region-solicitud" vacio="Todas" opciones={OPCIONES_REGION} value={busqueda.region} onChange={(e) => cambiar({ region: e.target.value })} />
            </>
          )}
          <Campo etiqueta="Pedida desde" id="filtro-desde-solicitud" type="date" value={busqueda.desde} onChange={(e) => cambiarDesde(e.target.value)} />
          <Campo etiqueta="Pedida hasta" id="filtro-hasta-solicitud" type="date" value={busqueda.hasta} onChange={(e) => cambiarHasta(e.target.value)} />
        </div>
      )}
    </section>
  );
}

// Ciudadana activa que el hospital todavia no revisa (no la confirma ni la marca falsa)
function porConfirmar(s) {
  return s.estado === 'activa' && s.por_confirmar;
}

const FONDO_SIN_REVISAR = 'bg-amber-50 hover:bg-amber-100';

// Solicitudes que pidio un ciudadano y el hospital aun no revisa: nadie recibe aviso hasta entonces
function SinRevisar({ lista, base, esAdmin }) {
  if (lista.length === 0) return null;

  return (
    <section aria-labelledby="titulo-sin-revisar" className="mb-6 rounded-xl border border-amber-300 bg-amber-50">
      <header className="flex items-start gap-3 border-b border-amber-200 px-5 py-3.5">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="titulo-sin-revisar" className="text-sm font-semibold text-gray-900">
            Solicitudes sin revisar ({lista.length})
          </h2>
          <p className="mt-0.5 text-sm text-gray-700">
            {lista.length === 1 ? 'Una solicitud ciudadana espera' : lista.length + ' solicitudes ciudadanas esperan'} tu revisión. Ningún donante recibe aviso hasta que confirmes que el paciente está en el hospital; revísalas antes de que caduquen.
          </p>
        </div>
      </header>
      <ul className="divide-y divide-amber-200">
        {lista.map((s) => (
          <li key={s.id}>
            <Link to={base + '/solicitudes/' + s.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-amber-100/60">
              <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">
                  {esAdmin ? s.hospital_nombre + ' · ' : ''}Para {s.paciente_nombre}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-700">
                  <BadgeUrgencia urgencia={s.urgencia} />
                  Pedida {hace(s.fecha_solicitud).toLowerCase()}
                  {s.fecha_caducidad && <> · Caduca el {fechaHora(s.fecha_caducidad)}</>}
                </span>
              </span>
              <span className="hidden shrink-0 text-sm font-medium text-amber-800 sm:inline">Revisar</span>
              <ChevronRight className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
