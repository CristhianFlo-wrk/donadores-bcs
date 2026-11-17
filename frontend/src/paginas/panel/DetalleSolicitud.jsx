import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { CircleCheck } from 'lucide-react';
import { auditoria, notificaciones, solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { Aviso, BarraProgreso, Boton, Cargando, Dialogo, EncabezadoPagina, EstadoConsulta, FichaSangre, Panel, Selector, TiraMetricas, TituloSeccion, Vacio } from '../../componentes/ui.jsx';
import DialogoDonacion from '../../componentes/DialogoDonacion.jsx';
import FotosSolicitud from '../../componentes/FotosSolicitud.jsx';
import { puedeRecibirDe } from '../../utils/compatibilidad.js';
import { BadgeEstadoNotificacion, BadgeEstadoSolicitud, BadgeUrgencia, InsigniasCiudadana, textoUrgencia } from '../../componentes/insignias.jsx';
import BloqueIntegridad from '../../componentes/BloqueIntegridad.jsx';
import { codigoAsistencia, fecha, fechaHora, hace, nombreRegion } from '../../utils/formato.js';

export default function DetalleSolicitud() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  const base = usuario.rol === 'admin' ? '/admin' : '/hospital';
  // Solo el hospital de la solicitud y el admin la gestionan; el backend responde 403 a los demas
  const gestiona = (solicitud) => usuario.rol === 'admin' || usuario.id_hospital === solicitud.hospital.id;

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
                  <InsigniasCiudadana solicitud={solicitud} />
                  <span>{solicitud.hospital.nombre} · {nombreRegion(solicitud.hospital.region)} · {fechaHora(solicitud.fecha_solicitud)}</span>
                </span>
              }
              acciones={gestiona(solicitud) && solicitud.estado === 'activa' && (
                <Acciones solicitud={solicitud} alTerminar={(nuevoAviso) => { setAviso(nuevoAviso); consulta.recargar(); }} />
              )}
            />

            {aviso && <Aviso tono={aviso.tono} className="mb-6">{aviso.texto}</Aviso>}
            {gestiona(solicitud) && solicitud.ciudadana && solicitud.estado === 'activa' && solicitud.por_confirmar && (
              <Aviso tono="aviso" className="mb-6">
                La pidió un donante y todavía no se avisa a nadie. Revisa que el paciente esté en el hospital.{' '}
                <a href="#moderacion" className="font-semibold underline underline-offset-2 hover:no-underline">Confirmar la solicitud</a>
              </Aviso>
            )}

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

                {gestiona(solicitud) && <Panel
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
                            detalle={'Sangre ' + solicitud.tipo_sangre + ' · Solicitud #' + solicitud.id}
                            registroBloqueado={['cancelada', 'falsa'].includes(solicitud.estado)}
                            alRegistrar={(nuevoAviso) => { setAviso(nuevoAviso); consulta.recargar(); }}
                            alVerificar={() => setVerificando(n.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </Panel>}

                {(solicitud.historia || solicitud.imagenes.length > 0) && (
                  <PanelPublicacion
                    solicitud={solicitud}
                    puedeModerar={gestiona(solicitud)}
                    alCambiar={(nuevoAviso) => { setAviso(nuevoAviso); consulta.recargar(); }}
                  />
                )}
              </div>

              <aside className="space-y-6 xl:sticky xl:top-8">
                <Panel titulo="Quién puede cubrirla">
                  <div className="flex flex-wrap gap-1.5">
                    {puedeRecibirDe(solicitud.tipo_sangre).map((t) => <FichaSangre key={t} tipo={t} tamano="sm" />)}
                  </div>
                  <p className="mt-3 text-sm text-gray-700">
                    {solicitud.por_confirmar && solicitud.estado === 'activa' ? 'Todavía no se avisa a nadie. Al confirmarla: ' : ''}
                    {ALCANCE_URGENCIA[solicitud.urgencia]}
                  </p>
                </Panel>
                {solicitud.paciente && <PanelPaciente solicitud={solicitud} />}
                {gestiona(solicitud) && solicitud.ciudadana && ESTADOS_MODERABLES.includes(solicitud.estado) && (
                  <Moderacion key={solicitud.urgencia + String(solicitud.por_confirmar)} solicitud={solicitud} alTerminar={(nuevoAviso) => { setAviso(nuevoAviso); consulta.recargar(); }} />
                )}
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

const ALCANCE_URGENCIA = {
  critica: 'Prioridad crítica: se avisa a donantes compatibles de todo el estado.',
  urgente: 'Prioridad urgente: se avisa a donantes de la región del hospital. Puedes ampliar a todo el estado.',
  normal: 'Prioridad programada: se avisa a donantes de la región del hospital. Puedes ampliar a todo el estado.'
};

// Una ciudadana se puede marcar falsa aunque el autor la haya cancelado o haya caducado
const ESTADOS_MODERABLES = ['activa', 'cancelada', 'caducada'];

function PanelPaciente({ solicitud }) {
  const { paciente } = solicitud;
  return (
    <Panel titulo="Paciente">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-600">Nombre</dt>
          <dd className="text-right font-medium text-gray-900">{paciente.nombre}</dd>
        </div>
        {'expediente' in paciente && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Expediente</dt>
            <dd className={'text-right ' + (paciente.expediente ? 'font-medium text-gray-900' : 'text-gray-500')}>{paciente.expediente || 'Sin expediente'}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-sm text-gray-700">{paciente.para_si_mismo ? 'El paciente es quien la pidió.' : 'Pedida por un donante.'}</p>
      {solicitud.estado === 'activa' && solicitud.fecha_caducidad && (
        <p className="mt-1 text-xs text-gray-600">Caduca el {fechaHora(solicitud.fecha_caducidad)}</p>
      )}
    </Panel>
  );
}

// Mensaje y fotos del autor tal como los veran los donantes. Antes de confirmar se revisan; si algo no debe publicarse
// (un telefono, una foto que no corresponde) se quita sin rechazar toda la solicitud
function PanelPublicacion({ solicitud, puedeModerar, alCambiar }) {
  const [confirmarMensaje, setConfirmarMensaje] = useState(false);
  const [quitandoMensaje, setQuitandoMensaje] = useState(false);
  const porConfirmar = solicitud.estado === 'activa' && solicitud.por_confirmar;

  async function quitarFoto(idImagen) {
    try {
      await solicitudes.quitarImagen(solicitud.id, idImagen);
      alCambiar({ tono: 'info', texto: 'Foto quitada. Los donantes ya no la verán.' });
    } catch (e) {
      alCambiar({ tono: 'error', texto: e.message });
    }
  }

  async function quitarMensaje() {
    setQuitandoMensaje(true);
    try {
      await solicitudes.quitarHistoria(solicitud.id);
      alCambiar({ tono: 'info', texto: 'Mensaje quitado. Los donantes ya no lo verán.' });
    } catch (e) {
      alCambiar({ tono: 'error', texto: e.message });
    } finally {
      setQuitandoMensaje(false);
      setConfirmarMensaje(false);
    }
  }

  return (
    <Panel
      titulo="Lo que verán los donantes"
      detalle={porConfirmar ? 'Revísalo antes de confirmar: se publica al confirmar la solicitud.' : 'Mensaje y fotos de quien la pidió.'}
    >
      <div className="space-y-4">
        {solicitud.historia && (
          <div>
            <p className="whitespace-pre-line text-sm text-gray-800 [overflow-wrap:anywhere]">{solicitud.historia}</p>
            {puedeModerar && (confirmarMensaje ? (
              <div className="mt-2 flex gap-2">
                <Boton variante="peligro" className="px-3 py-1.5 text-xs" cargando={quitandoMensaje} onClick={quitarMensaje}>Sí, quitar mensaje</Boton>
                <Boton variante="neutro" className="px-3 py-1.5 text-xs" disabled={quitandoMensaje} onClick={() => setConfirmarMensaje(false)}>No</Boton>
              </div>
            ) : (
              <Boton variante="contorno" className="mt-2 px-3 py-1.5 text-xs" onClick={() => setConfirmarMensaje(true)}>Quitar mensaje</Boton>
            ))}
          </div>
        )}
        <FotosSolicitud solicitud={solicitud} alQuitar={puedeModerar ? quitarFoto : null} />
        {puedeModerar && <p className="text-xs text-gray-600">Quitar algo lo borra para siempre y queda anotado en la bitácora.</p>}
      </div>
    </Panel>
  );
}

// Solo solicitudes ciudadanas: confirmarla (la primera vez avisa a los donantes), cambiar la urgencia y marcar como falsa
function Moderacion({ solicitud, alTerminar }) {
  const activa = solicitud.estado === 'activa';
  const porConfirmar = activa && solicitud.por_confirmar;
  const [urgencia, setUrgencia] = useState(solicitud.urgencia);
  const [ocupado, setOcupado] = useState(null);
  const [confirmarFalsa, setConfirmarFalsa] = useState(false);

  async function ejecutar(nombre, accion) {
    setOcupado(nombre);
    try {
      alTerminar(await accion());
    } catch (e) {
      alTerminar({ tono: 'error', texto: e.message });
    } finally {
      setOcupado(null);
      setConfirmarFalsa(false);
    }
  }

  const cambiar = (nueva) => ejecutar(nueva, async () => {
    const resultado = await solicitudes.cambiarUrgencia(solicitud.id, nueva);
    if (porConfirmar) {
      return { tono: 'exito', texto: 'Solicitud confirmada como ' + textoUrgencia(nueva).toLowerCase() + '. ' + textoNotificados(resultado.notificaciones_enviadas) };
    }
    if (nueva === 'critica') {
      return { tono: 'exito', texto: 'Urgencia cambiada a crítica. ' + textoNotificados(resultado.notificaciones_enviadas) };
    }
    return { tono: 'info', texto: 'Urgencia cambiada a ' + textoUrgencia(nueva).toLowerCase() + '.' };
  });

  const marcarFalsa = () => ejecutar('falsa', async () => {
    await solicitudes.cerrar(solicitud.id, 'falsa');
    return { tono: 'info', texto: 'Solicitud marcada como falsa. Se sumó una falta a la cuenta de quien la pidió.' };
  });

  // Al confirmar se puede dejar la urgencia que pidio el donante; despues solo se cambia a otra
  const sinCambio = !porConfirmar && urgencia === solicitud.urgencia;

  return (
    <Panel id="moderacion" titulo="Moderación" detalle="Solicitud pedida por un donante" className="scroll-mt-20">
      <div className="space-y-4">
        {porConfirmar && (
          <Aviso tono="aviso">
            Nadie ha recibido aviso todavía. Confirma que el paciente está en el hospital y elige la urgencia
            {solicitud.urgencia === 'critica' ? ' (el donante dijo que se necesita de inmediato)' : ''}. Al confirmar se avisa a los donantes compatibles.
          </Aviso>
        )}

        {activa && (
          <div className="flex items-end gap-2">
            <Selector
              etiqueta="Urgencia"
              id="moderar-urgencia"
              className="min-w-0 flex-1"
              value={urgencia}
              onChange={(e) => setUrgencia(e.target.value)}
              opciones={['critica', 'urgente', 'normal'].map((u) => ({ valor: u, texto: textoUrgencia(u) }))}
            />
            <Boton variante={porConfirmar ? 'primario' : 'contorno'} disabled={!urgencia || sinCambio || Boolean(ocupado)} cargando={ocupado === urgencia} onClick={() => cambiar(urgencia)}>
              {porConfirmar ? 'Confirmar y avisar' : 'Cambiar'}
            </Boton>
          </div>
        )}

        {solicitud.metricas?.donaciones > 0 ? (
          <p className="text-sm text-gray-700">Ya tiene donaciones registradas: el paciente sí estaba en el hospital, así que no se puede marcar como falsa.</p>
        ) : confirmarFalsa ? (
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm text-gray-700">
              {activa ? 'Se cerrará y sumará una falta a la cuenta de quien la pidió.' : 'Sumará una falta a la cuenta de quien la pidió.'} Esta acción no se puede deshacer.
            </p>
            <div className="mt-2 flex gap-2">
              <Boton variante="peligro" cargando={ocupado === 'falsa'} onClick={marcarFalsa}>Sí, marcar como falsa</Boton>
              <Boton variante="neutro" disabled={Boolean(ocupado)} onClick={() => setConfirmarFalsa(false)}>No</Boton>
            </div>
          </div>
        ) : (
          <Boton variante="peligro" className="w-full" disabled={Boolean(ocupado)} onClick={() => setConfirmarFalsa(true)}>Marcar como falsa</Boton>
        )}
      </div>
    </Panel>
  );
}

function textoNotificados(cantidad) {
  if (cantidad === 0) return 'No se encontraron donantes compatibles nuevos para notificar.';
  return 'Se notificó a ' + cantidad + (cantidad === 1 ? ' donante' : ' donantes') + '.';
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

// Una ciudadana por confirmar no muestra Notificar: se confirma y avisa desde Moderacion
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
      {!solicitud.por_confirmar && (
        <Boton className="col-span-2" cargando={ocupado === 'region'} disabled={Boolean(ocupado)} onClick={() => notificar(false)}>
          Notificar donantes
        </Boton>
      )}
      {!solicitud.por_confirmar && solicitud.urgencia !== 'critica' && (
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

function FilaNotificacion({ notificacion: n, detalle, registroBloqueado, alRegistrar, alVerificar }) {
  const [registrando, setRegistrando] = useState(false);

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
        {n.estado === 'confirmada' && !registroBloqueado && (
          <Boton className="flex-1 px-3 py-1.5 @3xl:flex-none" onClick={() => setRegistrando(true)}>Registrar donación</Boton>
        )}
        <Boton variante="contorno" className="flex-1 px-3 py-1.5 @3xl:flex-none" onClick={alVerificar}>Ver historial</Boton>
      </div>
      {registrando && (
        <DialogoDonacion
          notificacion={n}
          detalle={detalle}
          alCerrar={() => setRegistrando(false)}
          alRegistrar={(texto) => { setRegistrando(false); alRegistrar({ tono: 'exito', texto }); }}
        />
      )}
    </li>
  );
}

// Historial verificado del donante notificado, sin datos personales
function ModalHistorial({ idNotificacion, alCerrar }) {
  const consulta = useConsulta(() => auditoria.porNotificacion(idNotificacion), [idNotificacion]);

  return (
    <Dialogo id="titulo-historial" titulo={'Historial del donante ' + codigoAsistencia(idNotificacion)} alCerrar={alCerrar}>
      {consulta.cargando ? <Cargando /> : consulta.error ? <Aviso>{consulta.error.message}</Aviso> : (
        <>
          <BloqueIntegridad verificacion={consulta.datos.verificacion} />
          <TituloSeccion className="mt-6">{consulta.datos.total} {consulta.datos.total === 1 ? 'donación registrada' : 'donaciones registradas'}</TituloSeccion>
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
    </Dialogo>
  );
}
