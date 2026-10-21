import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { MapPin } from 'lucide-react';
import { notificaciones } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { Aviso, Badge, Boton, EncabezadoPagina, EstadoConsulta, FichaSangre, TituloSeccion, Vacio } from '../../componentes/ui.jsx';
import { BadgeEstadoNotificacion } from '../../componentes/insignias.jsx';
import { codigoAsistencia, hace } from '../../utils/formato.js';

export default function Alertas() {
  const consulta = useConsulta(() => notificaciones.mias(), [], { intervaloMs: 30000 });
  const { recargarAlertas } = useOutletContext();

  const lista = consulta.datos?.notificaciones || [];
  const nuevas = lista.filter((n) => n.estado === 'enviada' && n.solicitud_estado === 'activa').length;
  const abiertas = lista.filter((n) => n.solicitud_estado === 'activa' && n.estado !== 'donada');
  const anteriores = lista.filter((n) => !(n.solicitud_estado === 'activa' && n.estado !== 'donada'));

  async function alResponder() {
    await consulta.recargar();
    recargarAlertas();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Alertas"
        descripcion={nuevas > 0 ? nuevas + (nuevas === 1 ? ' alerta espera tu respuesta.' : ' alertas esperan tu respuesta.') : 'No tienes alertas pendientes de responder.'}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <EstadoConsulta consulta={consulta}>
            {() => lista.length === 0 ? (
              <Vacio titulo="Sin alertas por ahora">Cuando un hospital necesite tu tipo de sangre te llegará un aviso aquí y por SMS.</Vacio>
            ) : (
              <>
                <TituloSeccion>Solicitudes abiertas</TituloSeccion>
                {abiertas.length === 0 ? (
                  <Vacio titulo="Ninguna solicitud abierta">Las alertas nuevas aparecerán aquí.</Vacio>
                ) : (
                  <ul className="grid gap-4 md:grid-cols-2 md:items-start xl:grid-cols-1 2xl:grid-cols-2">
                    {abiertas.map((n) => (
                      <li key={n.id}><TarjetaAlerta notificacion={n} alResponder={alResponder} /></li>
                    ))}
                  </ul>
                )}

                {anteriores.length > 0 && (
                  <>
                    <TituloSeccion className="mt-8">Anteriores</TituloSeccion>
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                      {anteriores.map((n) => (
                        <li key={n.id} className="flex items-center gap-4 px-5 py-3.5">
                          <FichaSangre tipo={n.tipo_sangre} tamano="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">{n.hospital_nombre}</p>
                            <p className="text-xs text-gray-600">{hace(n.fecha_envio)}</p>
                          </div>
                          {n.estado === 'donada' ? <BadgeEstadoNotificacion estado="donada" /> : <Badge tono="gris">Solicitud cerrada</Badge>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </EstadoConsulta>
        </div>

        <PasosConfirmacion />
      </div>
    </>
  );
}

function TarjetaAlerta({ notificacion: n, alResponder }) {
  const [enviando, setEnviando] = useState(null);
  const [error, setError] = useState('');
  const pendiente = n.estado === 'enviada';

  async function responder(respuesta) {
    setEnviando(respuesta);
    setError('');
    try {
      await notificaciones.responder(n.id, respuesta);
      await alResponder();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(null);
    }
  }

  return (
    <article className={'rounded-xl border bg-white p-5 ' + (pendiente ? 'border-acento-200 ring-1 ring-acento-100' : 'border-gray-200')}>
      <div className="flex items-start gap-4">
        <FichaSangre tipo={n.tipo_sangre} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {n.urgencia === 'critica' ? 'Alerta crítica' : 'Alerta urgente'}
            </h3>
            <span className="text-xs text-gray-600">{hace(n.fecha_envio)}</span>
          </div>
          <p className="mt-0.5 text-sm text-gray-800">{n.hospital_nombre}</p>
          {n.hospital_direccion && (
            <p className="mt-1 flex items-start gap-1 text-xs text-gray-600">
              <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {n.hospital_direccion}
            </p>
          )}
          <div className="mt-3">
            <BadgeEstadoNotificacion estado={n.estado} />
          </div>
        </div>
      </div>

      {n.estado === 'confirmada' && (
        <div className="mt-4 animate-aparecer rounded-lg bg-acento-600 p-4 text-white motion-reduce:animate-none sm:p-5">
          <p className="text-sm font-medium">Código de asistencia</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-wide">{codigoAsistencia(n.id)}</p>
          <p className="mt-2 text-sm">
            Muéstralo en el hospital junto con una identificación oficial. Puedes cambiar tu respuesta mientras no se registre la donación.
          </p>
        </div>
      )}
      {(n.estado === 'enviada' || n.estado === 'confirmada' || n.estado === 'rechazada') && (
        <div className="mt-4 flex flex-wrap gap-2">
          {n.estado !== 'confirmada' && (
            <Boton cargando={enviando === 'confirmada'} disabled={Boolean(enviando)} onClick={() => responder('confirmada')} className="min-w-36 flex-1 py-3">
              Asistiré
            </Boton>
          )}
          {n.estado !== 'rechazada' && (
            <Boton variante="neutro" cargando={enviando === 'rechazada'} disabled={Boolean(enviando)} onClick={() => responder('rechazada')} className="min-w-36 flex-1 py-3">
              No puedo asistir
            </Boton>
          )}
        </div>
      )}
      <Aviso className="mt-3">{error}</Aviso>
    </article>
  );
}

const PASOS = [
  { titulo: 'Confirma tu asistencia', detalle: 'Toca "Asistiré" en la alerta. Recibirás un código de asistencia N-0000.' },
  { titulo: 'Acude al hospital', detalle: 'Lleva una identificación oficial vigente con fotografía. No necesitas ayunar.' },
  { titulo: 'Presenta tu código', detalle: 'El personal identifica tu respuesta con el código; el hospital no ve tu nombre en el sistema.' },
  { titulo: 'Evaluación y donación', detalle: 'El médico confirma si puedes donar ese día. Si donas, el hospital lo registra.' },
  { titulo: 'Queda en tu historial', detalle: 'La donación aparece en Historial con su sello de integridad y empieza tu periodo de espera.' }
];

function PasosConfirmacion() {
  return (
    <aside aria-labelledby="titulo-pasos" className="rounded-xl border border-gray-200 bg-white xl:sticky xl:top-8">
      <h2 id="titulo-pasos" className="border-b border-gray-100 px-5 py-3.5 text-sm font-semibold text-gray-900">Qué pasa después de confirmar</h2>
      <ol className="space-y-4 p-5">
        {PASOS.map((paso, indice) => (
          <li key={paso.titulo} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-acento-50 text-xs font-semibold tabular-nums text-acento-700" aria-hidden="true">
              {indice + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{paso.titulo}</p>
              <p className="mt-0.5 text-sm text-gray-700">{paso.detalle}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
