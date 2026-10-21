import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { CircleCheck, X } from 'lucide-react';
import { auditoria, notificaciones, solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { Aviso, BarraProgreso, Boton, Cargando, EncabezadoPagina, EstadoConsulta, FichaSangre, Panel, TiraMetricas, TituloSeccion, Vacio } from '../../componentes/ui.jsx';
import { puedeRecibirDe } from '../../utils/compatibilidad.js';
import { BadgeEstadoNotificacion, BadgeEstadoSolicitud, BadgeUrgencia } from '../../componentes/insignias.jsx';
import BloqueIntegridad from '../../componentes/BloqueIntegridad.jsx';
import { codigoAsistencia, fecha, fechaHora, hace, nombreRegion } from '../../utils/formato.js';

export default function DetalleSolicitud() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  const base = usuario.rol === 'admin' ? '/admin' : '/hospital';

  // El contador de respuestas se actualiza cada 10 s (polling)
  const consulta = useConsulta(() => solicitudes.obtener(id), [id], { intervaloMs: 10000 });
  const [aviso, setAviso] = useState(() => {
    const notificados = ubicacion.state?.notificados;
    if (notificados === undefined || notificados === null) return null;
    return { tono: notificados > 0 ? 'exito' : 'aviso', texto: 'Solicitud creada. ' + textoNotificados(notificados) };
  });
  const [verificando, setVerificando] = useState(null);

  return (
    <>
      <EstadoConsulta consulta={consulta}>
        {({ solicitud }) => (
          <>
            <EncabezadoPagina
              volver={{ ruta: base + '/solicitudes', texto: 'Solicitudes' }}
              antes={<FichaSangre tipo={solicitud.tipo_sangre} tamano="lg" />}
              titulo={'Solicitud de sangre ' + solicitud.tipo_sangre}
              descripcion={
                <span className="flex flex-wrap items-center gap-2">
                  <BadgeUrgencia urgencia={solicitud.urgencia} />
                  <BadgeEstadoSolicitud estado={solicitud.estado} />
                  <span>{solicitud.hospital.nombre} · {nombreRegion(solicitud.hospital.region)} · {fechaHora(solicitud.fecha_solicitud)}</span>
                </span>
              }
              acciones={solicitud.estado === 'activa' && (
                <Acciones solicitud={solicitud} alTerminar={(nuevoAviso) => { setAviso(nuevoAviso); consulta.recargar(); }} />
              )}
            />

            {aviso && <Aviso tono={aviso.tono} className="mb-6">{aviso.texto}</Aviso>}

            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-6">
                <ProgresoUnidades donadas={solicitud.metricas.donaciones} requeridas={solicitud.unidades_requeridas} activa={solicitud.estado === 'activa'} />

                <TiraMetricas
                  metricas={[
                    { etiqueta: 'Notificados', valor: solicitud.metricas.total_notificados },
                    { etiqueta: 'Confirmaron', valor: solicitud.metricas.confirmaciones },
                    { etiqueta: 'Sin responder', valor: solicitud.metricas.pendientes },
                    { etiqueta: 'Rechazaron', valor: solicitud.metricas.rechazadas },
                    { etiqueta: 'Donaron', valor: solicitud.metricas.donaciones }
                  ]}
                />

                <Panel
                  titulo="Donantes notificados"
                  detalle="Por privacidad no se muestran nombres. El donante presenta su código de asistencia al llegar."
                  cuerpo=""
                >
                  {(solicitud.notificaciones || []).length === 0 ? (
                    <Vacio titulo="Aún no se ha notificado a ningún donante" className="m-5" />
                  ) : (
                    <div className="@container text-sm">
                      <div className={'hidden px-5 py-2.5 text-xs font-medium text-gray-600 @3xl:grid ' + COLUMNAS_NOTIFICACION}>
                        <span>Código</span>
                        <span>Estado</span>
                        <span>Notificado</span>
                        <span>Respuesta</span>
                        <span className="text-right">Acciones</span>
                      </div>
                      <ul className="divide-y divide-gray-100 border-t border-gray-100">
                        {[...solicitud.notificaciones].sort((a, b) => (ORDEN_NOTIFICACION[a.estado] ?? 9) - (ORDEN_NOTIFICACION[b.estado] ?? 9)).map((n) => (
                          <FilaNotificacion
                            key={n.id}
                            notificacion={n}
                            solicitudCancelada={solicitud.estado === 'cancelada'}
                            alRegistrar={(nuevoAviso) => { setAviso(nuevoAviso); consulta.recargar(); }}
                            alVerificar={() => setVerificando(n.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </Panel>
              </div>

              <aside className="space-y-6 xl:sticky xl:top-8">
                <Panel titulo="Quién puede cubrirla">
                  <div className="flex flex-wrap gap-1.5">
                    {puedeRecibirDe(solicitud.tipo_sangre).map((t) => <FichaSangre key={t} tipo={t} tamano="sm" />)}
                  </div>
                  <p className="mt-3 text-sm text-gray-700">
                    {solicitud.urgencia === 'critica'
                      ? 'Prioridad crítica: se avisa a donantes compatibles de todo el estado.'
                      : 'Prioridad urgente: se avisa a donantes de la región del hospital. Puedes ampliar a todo el estado.'}
                  </p>
                </Panel>
                {solicitud.descripcion && (
                  <Panel titulo="Descripción">
                    <p className="text-sm text-gray-800">{solicitud.descripcion}</p>
                  </Panel>
                )}
                {solicitud.estado === 'activa' && (
                  <p className="text-xs text-gray-600">Los contadores se actualizan solos cada 10 segundos.</p>
                )}
              </aside>
            </div>
          </>
        )}
      </EstadoConsulta>

      {verificando && <ModalHistorial idNotificacion={verificando} alCerrar={() => setVerificando(null)} />}
    </>
  );
}

function textoNotificados(cantidad) {
  if (cantidad === 0) return 'No se encontraron donantes compatibles nuevos para notificar.';
  return 'Se notificó a ' + cantidad + (cantidad === 1 ? ' donante' : ' donantes') + ' por push y SMS.';
}

// Cada donacion registrada cuenta como una unidad
// Al juntar todas las unidades el bloque pasa a verde lleno: es el momento de cerrar la solicitud
function ProgresoUnidades({ donadas, requeridas, activa }) {
  const completa = donadas >= requeridas;

  if (completa) {
    return (
      <section aria-labelledby="titulo-unidades" className="animate-aparecer rounded-xl bg-emerald-700 p-5 text-white motion-reduce:animate-none md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CircleCheck className="size-8 shrink-0" aria-hidden="true" />
            <h2 id="titulo-unidades" className="font-display text-2xl font-bold leading-tight md:text-[1.75rem]">Unidades obtenidas</h2>
          </div>
          <p className="flex items-baseline gap-1.5 text-base">
            <span className="font-display text-5xl font-bold leading-none tabular-nums">{donadas}</span>
            de <span className="tabular-nums">{requeridas}</span> {requeridas === 1 ? 'unidad' : 'unidades'}
          </p>
        </div>
        {activa && (
          <p className="mt-3 text-sm">Se alcanzaron las unidades requeridas. Puedes marcar la solicitud como completada.</p>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-unidades" className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="titulo-unidades" className="text-sm font-semibold text-gray-900">Unidades obtenidas</h2>
        <p className="flex items-baseline gap-1.5 text-sm text-gray-600">
          <span className="font-display text-5xl font-bold leading-none tabular-nums text-gray-900">{donadas}</span>
          de <span className="tabular-nums">{requeridas}</span> {requeridas === 1 ? 'unidad' : 'unidades'}
        </p>
      </div>
      <BarraProgreso valor={donadas} maximo={requeridas} etiqueta="Unidades obtenidas" className="mt-4" />
    </section>
  );
}

// Primero quien confirmo (viene en camino), luego sin responder, luego el resto
const ORDEN_NOTIFICACION = { confirmada: 0, enviada: 1, donada: 2, rechazada: 3 };

function Acciones({ solicitud, alTerminar }) {
  const [ocupado, setOcupado] = useState(null);
  const [confirmarCierre, setConfirmarCierre] = useState(null);

  async function ejecutar(nombre, accion) {
    setOcupado(nombre);
    try {
      alTerminar(await accion());
    } catch (e) {
      alTerminar({ tono: 'error', texto: e.message });
    } finally {
      setOcupado(null);
      setConfirmarCierre(null);
    }
  }

  const notificar = (todas) => ejecutar(todas ? 'todas' : 'region', async () => {
    const resultado = await notificaciones.notificar({ id_solicitud: solicitud.id, todas_las_regiones: todas });
    return { tono: resultado.notificaciones_enviadas > 0 ? 'exito' : 'aviso', texto: textoNotificados(resultado.notificaciones_enviadas) };
  });

  const cerrar = (estado) => ejecutar(estado, async () => {
    await solicitudes.cerrar(solicitud.id, estado);
    return { tono: 'info', texto: estado === 'completada' ? 'Solicitud marcada como completada.' : 'Solicitud cancelada.' };
  });

  if (confirmarCierre) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 sm:w-auto">
        <p className="text-sm text-gray-700">
          {confirmarCierre === 'completada' ? '¿Marcar como completada?' : '¿Cancelar la solicitud?'} Esta acción no se puede deshacer.
        </p>
        <div className="mt-2 flex gap-2">
          <Boton variante={confirmarCierre === 'completada' ? 'primario' : 'peligro'} cargando={Boolean(ocupado)} onClick={() => cerrar(confirmarCierre)}>
            Sí, continuar
          </Boton>
          <Boton variante="neutro" disabled={Boolean(ocupado)} onClick={() => setConfirmarCierre(null)}>No</Boton>
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
      <Boton className="col-span-2" cargando={ocupado === 'region'} disabled={Boolean(ocupado)} onClick={() => notificar(false)}>
        Notificar donantes
      </Boton>
      {solicitud.urgencia !== 'critica' && (
        <Boton variante="contorno" className="col-span-2" cargando={ocupado === 'todas'} disabled={Boolean(ocupado)} onClick={() => notificar(true)}>
          Ampliar a todo el estado
        </Boton>
      )}
      <Boton variante="contorno" disabled={Boolean(ocupado)} onClick={() => setConfirmarCierre('completada')}>Completar</Boton>
      <Boton variante="peligro" disabled={Boolean(ocupado)} onClick={() => setConfirmarCierre('cancelada')}>Cancelar</Boton>
    </div>
  );
}

// Con espacio suficiente la lista se ve como tabla; en un contenedor angosto cada notificacion es una tarjeta
const COLUMNAS_NOTIFICACION = '@3xl:grid-cols-[6rem_11rem_minmax(0,1fr)_minmax(0,1fr)_auto] @3xl:gap-4';

function FilaNotificacion({ notificacion: n, solicitudCancelada, alRegistrar, alVerificar }) {
  const [registrando, setRegistrando] = useState(false);

  async function registrar() {
    setRegistrando(true);
    try {
      await notificaciones.registrarDonacion(n.id);
      alRegistrar({ tono: 'exito', texto: 'Donación ' + codigoAsistencia(n.id) + ' registrada en el historial del donante.' });
    } catch (e) {
      alRegistrar({ tono: 'error', texto: e.message });
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <li className={'px-5 py-3.5 @3xl:grid @3xl:items-center ' + COLUMNAS_NOTIFICACION}>
      <div className="flex items-center justify-between gap-2 @3xl:contents">
        <span className="font-mono text-sm font-semibold text-gray-900">{codigoAsistencia(n.id)}</span>
        <span><BadgeEstadoNotificacion estado={n.estado} /></span>
      </div>
      <p className="mt-1 text-xs text-gray-600 @3xl:mt-0 @3xl:text-sm"><span className="@3xl:hidden">Notificado: </span>{hace(n.fecha_envio)}</p>
      <p className="text-xs text-gray-600 @3xl:text-sm">
        <span className="@3xl:hidden">Respuesta: </span>{n.fecha_respuesta ? fechaHora(n.fecha_respuesta) : '-'}
      </p>
      <div className="mt-3 flex gap-2 @3xl:mt-0 @3xl:justify-end">
        {n.estado === 'confirmada' && !solicitudCancelada && (
          <Boton className="flex-1 px-3 py-1.5 @3xl:flex-none" cargando={registrando} onClick={registrar}>Registrar donación</Boton>
        )}
        <Boton variante="contorno" className="flex-1 px-3 py-1.5 @3xl:flex-none" onClick={alVerificar}>Ver historial</Boton>
      </div>
    </li>
  );
}

// Historial verificado del donante notificado, sin datos personales
function ModalHistorial({ idNotificacion, alCerrar }) {
  const consulta = useConsulta(() => auditoria.porNotificacion(idNotificacion), [idNotificacion]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-gray-900/40 p-0 sm:items-center sm:p-4" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-historial"
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="titulo-historial" className="text-base font-bold text-gray-900">Historial del donante {codigoAsistencia(idNotificacion)}</h3>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-600">
            <X className="size-5" />
          </button>
        </div>
        {consulta.cargando ? <Cargando /> : consulta.error ? <Aviso>{consulta.error.message}</Aviso> : (
          <>
            <BloqueIntegridad verificacion={consulta.datos.verificacion} />
            <TituloSeccion className="mt-6">{consulta.datos.total} {consulta.datos.total === 1 ? 'donación previa' : 'donaciones previas'}</TituloSeccion>
            <ul className="divide-y divide-gray-100 text-sm">
              {consulta.datos.entradas.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2">
                  <span className="text-gray-700">{e.hospital_nombre}</span>
                  <span className="shrink-0 text-gray-500">{fecha(e.fecha_donacion)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
