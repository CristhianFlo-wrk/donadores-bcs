import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BellRing, BookOpen, CalendarClock, CircleCheck } from 'lucide-react';
import { donantes, notificaciones, solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { Aviso, Badge, Cargando, EncabezadoPagina, EnlaceBoton, FichaSangre, Panel, Vacio } from '../../componentes/ui.jsx';
import { BadgeUrgencia } from '../../componentes/insignias.jsx';
import { esCompatible } from '../../utils/compatibilidad.js';
import { fecha, hace, nombreRegion } from '../../utils/formato.js';

export default function Inicio() {
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

  // Primero las que su sangre puede cubrir y, dentro de ellas, las de su region
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
        <section aria-labelledby="titulo-alerta" className="mb-6 flex flex-col gap-4 rounded-xl border border-acento-200 bg-acento-50 p-5 sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-acento-600 text-white">
            <BellRing className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-acento-800">
              Solicitud {alertaPendiente.urgencia === 'critica' ? 'crítica' : 'urgente'} · {hace(alertaPendiente.fecha_envio)}
            </p>
            <h2 id="titulo-alerta" className="mt-0.5 text-lg font-bold text-gray-900">{alertaPendiente.hospital_nombre} necesita sangre {alertaPendiente.tipo_sangre}</h2>
            <p className="mt-0.5 text-sm text-gray-700">Tu tipo es compatible. Responde para que el hospital sepa si cuenta contigo.</p>
          </div>
          <EnlaceBoton to="/donante/alertas" className="shrink-0">Responder</EnlaceBoton>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          titulo="Solicitudes activas en el estado"
          detalle={listaSolicitudes.length > 0 ? compatibles + ' de ' + listaSolicitudes.length + ' las puede cubrir tu sangre ' + perfil.tipo_sangre : undefined}
          cuerpo=""
        >
          {consultaSolicitudes.cargando ? (
            <Cargando />
          ) : listaSolicitudes.length === 0 ? (
            <Vacio titulo="No hay solicitudes activas" className="m-5">Te avisaremos cuando un hospital necesite tu tipo de sangre.</Vacio>
          ) : (
            <ul className="divide-y divide-gray-100">
              {listaSolicitudes.map((s) => {
                const sirve = esCompatible(perfil.tipo_sangre, s.tipo_sangre);
                return (
                  <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                    <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{s.hospital_nombre}</p>
                      <p className="text-xs text-gray-600">
                        {s.unidades_requeridas} {s.unidades_requeridas === 1 ? 'unidad' : 'unidades'} · {nombreRegion(s.region)} · {hace(s.fecha_solicitud)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                      {sirve && <Badge tono="acento">Tu sangre sirve</Badge>}
                      <BadgeUrgencia urgencia={s.urgencia} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Disponibilidad perfil={perfil} stats={stats} alCambiar={consultaPerfil.recargar} />

          <Link to="/donante/antes-de-donar" className="group flex items-center gap-4 rounded-xl bg-acento-50 p-5 transition-colors hover:bg-acento-100">
            <BookOpen className="size-5 shrink-0 text-acento-600" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-acento-800">Antes de donar</span>
              <span className="block text-sm text-gray-700">Requisitos, el día de la donación y cuidados después.</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-acento-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}

function Disponibilidad({ perfil, stats, alCambiar }) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

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
    <Panel titulo="Mi disponibilidad">
      <div className="flex items-center justify-between gap-3">
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
          className={'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 disabled:opacity-60 ' + (perfil.disponible ? 'bg-emerald-600' : 'bg-gray-300')}
        >
          <span className={'absolute top-1 size-5 rounded-full bg-white transition-[left] ' + (perfil.disponible ? 'left-6' : 'left-1')} />
        </button>
      </div>

      {stats && <EsperaDonacion stats={stats} />}
      <Aviso className="mt-3">{error}</Aviso>
    </Panel>
  );
}

// Cuenta regresiva del periodo de espera entre donaciones; el periodo sale de los datos del backend
function EsperaDonacion({ stats }) {
  const etiquetaTotal = stats.total_donaciones + (stats.total_donaciones === 1 ? ' donación registrada' : ' donaciones registradas');

  if (stats.puede_donar) {
    return (
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CircleCheck className="size-5" aria-hidden="true" />
          Ya puedes donar de nuevo
        </p>
        <p className="mt-1 text-xs text-gray-600">{etiquetaTotal}</p>
      </div>
    );
  }

  const periodo = stats.dias_desde_ultima + stats.dias_para_poder_donar;
  const avance = Math.round((stats.dias_desde_ultima * 100) / periodo);
  const fechaDisponible = new Date(new Date(stats.ultima_donacion).getTime() + periodo * 86400000);

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-gray-700">
          <CalendarClock className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
          Podrás donar de nuevo en
        </p>
        <p className="text-2xl font-semibold tabular-nums text-gray-900">
          {stats.dias_para_poder_donar} <span className="text-sm font-normal text-gray-600">{stats.dias_para_poder_donar === 1 ? 'día' : 'días'}</span>
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-acento-100"
        role="progressbar"
        aria-label="Periodo de espera entre donaciones"
        aria-valuemin={0}
        aria-valuemax={periodo}
        aria-valuenow={stats.dias_desde_ultima}
      >
        <div className="h-full rounded-full bg-acento-600" style={{ width: avance + '%' }} />
      </div>
      <p className="mt-2 flex justify-between gap-2 text-xs text-gray-600">
        <span className="tabular-nums">Día {stats.dias_desde_ultima} de {periodo}</span>
        <span>Desde el {fecha(fechaDisponible)}</span>
      </p>
      <p className="mt-3 text-xs text-gray-600">{etiquetaTotal}</p>
    </div>
  );
}
