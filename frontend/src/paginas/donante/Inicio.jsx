import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpen, CalendarClock, CircleCheck } from 'lucide-react';
import { donantes, notificaciones, solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { Aviso, Badge, BarraProgreso, BloqueProtagonista, Boton, Cargando, EncabezadoPagina, EnlaceBoton, FichaSangre, Panel, Vacio } from '../../componentes/ui.jsx';
import { BadgeUrgencia } from '../../componentes/insignias.jsx';
import { esCompatible } from '../../utils/compatibilidad.js';
import { fecha, hace, nombreRegion } from '../../utils/formato.js';

// Orden de la pantalla: alerta pendiente, estado para donar, solicitudes activas y al final el impacto
export default function Inicio() {
  const { usuario } = useSesion();
  const consultaPerfil = useConsulta(() => donantes.perfil());
  const consultaStats = useConsulta(() => donantes.stats());
  const consultaAlertas = useConsulta(() => notificaciones.mias(), [], { intervaloMs: 30000 });
  const consultaSolicitudes = useConsulta(() => solicitudes.listar({ estado: 'activa' }), [], { intervaloMs: 60000 });

  if (consultaPerfil.cargando) return <Cargando />;
  if (consultaPerfil.error) return <Aviso>{consultaPerfil.error.message}</Aviso>;

  const perfil = consultaPerfil.datos.perfil;
  const stats = consultaStats.datos?.stats;

  // La alerta mas reciente que aun espera respuesta del donante
  const alertaPendiente = (consultaAlertas.datos?.notificaciones || []).find(
    (n) => n.estado === 'enviada' && n.solicitud_estado === 'activa'
  );

  const puntaje = (s) => Number(esCompatible(perfil.tipo_sangre, s.tipo_sangre)) * 2 + Number(s.region === perfil.ubicacion.region);
  const listaSolicitudes = [...(consultaSolicitudes.datos?.solicitudes || [])].sort((a, b) => puntaje(b) - puntaje(a));
  const compatibles = listaSolicitudes.filter((s) => esCompatible(perfil.tipo_sangre, s.tipo_sangre)).length;

  return (
    <>
      <EncabezadoPagina
        antes={<FichaSangre tipo={perfil.tipo_sangre} tamano="lg" />}
        titulo={perfil.nombre_completo}
        descripcion={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tono={perfil.disponible ? 'verde' : 'gris'}>{perfil.disponible ? 'Disponible' : 'En pausa'}</Badge>
            {nombreRegion(perfil.ubicacion.region)} · {perfil.ubicacion.municipio}
          </span>
        }
      />

      {alertaPendiente && (
        <BloqueProtagonista
          id="titulo-alerta"
          className="mb-6"
          meta={'Solicitud ' + (alertaPendiente.urgencia === 'critica' ? 'crítica' : 'urgente') + ' · ' + hace(alertaPendiente.fecha_envio)}
          titulo={alertaPendiente.hospital_nombre + ' necesita sangre ' + alertaPendiente.tipo_sangre}
          accion={<EnlaceBoton variante="blanco" to="/donante/alertas" className="w-full px-6 sm:w-auto">Responder</EnlaceBoton>}
        >
          Tu tipo es compatible. Responde para que el hospital sepa si cuenta contigo.
        </BloqueProtagonista>
      )}

      {stats && stats.total_donaciones === 0 && (
        <Bienvenida idUsuario={usuario.id} nombre={perfil.nombre_completo.split(' ')[0]} />
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <EstadoDonacion perfil={perfil} consultaStats={consultaStats} alCambiar={consultaPerfil.recargar} />

        <Panel
          titulo="Solicitudes activas en el estado"
          detalle={listaSolicitudes.length > 0 ? compatibles + ' de ' + listaSolicitudes.length + ' las puede cubrir tu sangre ' + perfil.tipo_sangre : undefined}
          cuerpo=""
          className="lg:col-start-2 lg:row-span-3 lg:row-start-1"
        >
          {consultaSolicitudes.cargando ? (
            <Cargando />
          ) : listaSolicitudes.length === 0 ? (
            <Vacio titulo="No hay solicitudes activas" className="m-5">Te avisaremos cuando un hospital necesite tu tipo de sangre.</Vacio>
          ) : (
            <ul className="divide-y divide-gray-100">
              {listaSolicitudes.map((s) => {
                const sirve = esCompatible(perfil.tipo_sangre, s.tipo_sangre);
                const insignias = (
                  <>
                    {sirve && <Badge tono="acento">Tu sangre sirve</Badge>}
                    <BadgeUrgencia urgencia={s.urgencia} />
                  </>
                );
                return (
                  <li key={s.id} className="flex items-start gap-3 px-5 py-4 sm:items-center sm:gap-4">
                    <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{s.hospital_nombre}</p>
                      <p className="mt-0.5 text-xs text-gray-600">
                        {s.unidades_requeridas} {s.unidades_requeridas === 1 ? 'unidad' : 'unidades'} · {nombreRegion(s.region)} · {hace(s.fecha_solicitud)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">{insignias}</div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">{insignias}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Impacto stats={stats} />

        <Link to="/donante/antes-de-donar" className="group flex items-center gap-4 rounded-xl bg-acento-50 p-5 transition-colors hover:bg-acento-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600">
          <BookOpen className="size-5 shrink-0 text-acento-600" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-acento-800">Antes de donar</span>
            <span className="block text-sm text-gray-700">Requisitos, el día de la donación y cuidados después.</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-acento-700 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

function Bienvenida({ idUsuario, nombre }) {
  const clave = 'donadores_bienvenida_' + idUsuario;
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(clave) === null;
    } catch {
      return true;
    }
  });

  function cerrar() {
    try {
      localStorage.setItem(clave, '1');
    } catch {
      // Sin almacenamiento se oculta solo durante esta visita
    }
    setVisible(false);
  }

  if (!visible) return null;

  const pasos = [
    'Mantén tu disponibilidad activa para recibir alertas.',
    'Cuando un hospital necesite tu tipo de sangre te llegará un aviso aquí y por SMS.',
    'Confirma tu asistencia y presenta tu código de asistencia en el hospital.'
  ];

  return (
    <section aria-labelledby="titulo-bienvenida" className="mb-6 rounded-xl border border-acento-200 bg-acento-50 p-5 md:p-6">
      <h2 id="titulo-bienvenida" className="text-base font-semibold text-gray-900">Te damos la bienvenida, {nombre}</h2>
      <p className="mt-1 text-sm text-gray-700">Así funciona Donadores BCS:</p>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {pasos.map((paso, indice) => (
          <li key={paso} className="flex gap-3 text-sm text-gray-800">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums text-acento-700 ring-1 ring-inset ring-acento-200" aria-hidden="true">
              {indice + 1}
            </span>
            <span>{paso}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <EnlaceBoton variante="contorno" to="/donante/antes-de-donar">Antes de donar</EnlaceBoton>
        <Boton variante="contorno" onClick={cerrar}>Entendido</Boton>
      </div>
    </section>
  );
}

function EstadoDonacion({ perfil, consultaStats, alCambiar }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const stats = consultaStats.datos?.stats;

  async function alternar() {
    setGuardando(true);
    setError('');
    try {
      await donantes.disponibilidad(!perfil.disponible);
      await alCambiar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-label="Estado para donar" className="rounded-xl border border-gray-200 bg-white lg:col-start-1">
      <div className="p-5 md:p-6">
        {consultaStats.cargando ? <Cargando /> : stats ? <CuentaRegresiva stats={stats} /> : <Aviso>{consultaStats.error?.message}</Aviso>}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 md:px-6">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {perfil.disponible ? 'Disponible para donar' : 'No disponible por ahora'}
          </p>
          <p className="text-sm text-gray-600">
            {perfil.disponible ? 'Recibirás alertas de solicitudes compatibles.' : 'No recibirás alertas mientras estés en pausa.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={perfil.disponible}
          aria-label="Cambiar disponibilidad"
          disabled={guardando}
          onClick={alternar}
          className={'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 disabled:opacity-60 motion-reduce:transition-none ' + (perfil.disponible ? 'bg-emerald-600' : 'bg-gray-300')}
        >
          <span className={'absolute top-1 size-5 rounded-full bg-white transition-[left] duration-300 ease-salida motion-reduce:transition-none ' + (perfil.disponible ? 'left-6' : 'left-1')} />
        </button>
      </div>
      {error && <Aviso className="mx-5 mb-4 md:mx-6">{error}</Aviso>}
    </section>
  );
}

// Cuenta regresiva del periodo de espera entre donaciones; el periodo sale de los datos del backend
function CuentaRegresiva({ stats }) {
  if (stats.puede_donar) {
    return (
      <div>
        <CircleCheck className="size-8 text-emerald-600" aria-hidden="true" />
        <p className="mt-3 font-display text-2xl font-bold leading-tight text-gray-900 md:text-3xl">
          {stats.total_donaciones === 0 ? 'Ya puedes donar' : 'Ya puedes donar de nuevo'}
        </p>
      </div>
    );
  }

  const periodo = stats.dias_desde_ultima + stats.dias_para_poder_donar;
  const fechaDisponible = new Date(new Date(stats.ultima_donacion).getTime() + periodo * 86400000);

  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <CalendarClock className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
        Podrás donar de nuevo en
      </p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-6xl font-bold leading-none tracking-tight tabular-nums text-gray-900">{stats.dias_para_poder_donar}</span>
        <span className="text-lg font-semibold text-gray-700">{stats.dias_para_poder_donar === 1 ? 'día' : 'días'}</span>
      </p>
      <p className="mt-2 text-sm text-gray-600">Desde el {fecha(fechaDisponible)}</p>
      <BarraProgreso className="mt-4" valor={stats.dias_desde_ultima} maximo={periodo} etiqueta="Periodo de espera entre donaciones" />
      <p className="mt-2 text-xs tabular-nums text-gray-600">Día {stats.dias_desde_ultima} de {periodo}</p>
    </div>
  );
}

function Impacto({ stats }) {
  if (!stats) return null;
  const total = stats.total_donaciones;
  const etiquetaTotal = total + (total === 1 ? ' donación registrada' : ' donaciones registradas');

  return (
    <section aria-labelledby="titulo-impacto" className="rounded-xl border border-gray-200 bg-white p-5 lg:col-start-1">
      <h2 id="titulo-impacto" className="text-sm font-semibold text-gray-900">Tu impacto</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-gray-700">Tu primera donación puede ayudar hasta a 3 pacientes</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">Hasta {total * 3}</p>
          <p className="mt-0.5 text-sm text-gray-600">pacientes: cada donación se separa en glóbulos rojos, plasma y plaquetas</p>
        </>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-sm">
        <span className="text-gray-600">{etiquetaTotal}</span>
        <Link to="/donante/historial" className="rounded font-semibold text-acento-700 hover:text-acento-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600">
          Ver historial
        </Link>
      </div>
    </section>
  );
}
