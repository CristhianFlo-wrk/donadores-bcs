import { auditoria, solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { BloqueProtagonista, EncabezadoPagina, EstadoConsulta, FichaSangre, Panel, TiraMetricas, Vacio } from '../../componentes/ui.jsx';
import BloqueIntegridad from '../../componentes/BloqueIntegridad.jsx';
import { BadgeEstadoSolicitud } from '../../componentes/insignias.jsx';
import { ESTADOS_ARCHIVADOS } from './MisSolicitudes.jsx';
import { fecha, fechaHora, folio, nombreRegion, selloLegible } from '../../utils/formato.js';

const DIAS_RECIENTE = 14;

export default function Historial() {
  const consulta = useConsulta(() => auditoria.miHistorial());
  // Si falla, el historial de donaciones se muestra igual, solo sin las canceladas
  const consultaSolicitudes = useConsulta(() => solicitudes.mias());
  const archivadas = (consultaSolicitudes.datos?.solicitudes || []).filter((s) => ESTADOS_ARCHIVADOS.includes(s.estado));

  return (
    <>
      <EncabezadoPagina
        titulo="Historial de donaciones"
        descripcion="Cada donación queda encadenada con SHA-256: nadie puede alterarla sin que se note."
      />

      <EstadoConsulta consulta={consulta}>
        {(datos) => {
          const entradas = [...datos.entradas].reverse();
          const total = entradas.length;
          // Una donacion de las ultimas dos semanas se agradece arriba de todo
          const reciente = total > 0 && Date.now() - new Date(entradas[0].fecha_donacion).getTime() < DIAS_RECIENTE * 86400000;
          return (
            <>
              {reciente && (
                <BloqueProtagonista
                  id="titulo-reciente"
                  className="mb-6"
                  meta={'Donación registrada · ' + fecha(entradas[0].fecha_donacion)}
                  titulo="Gracias por donar"
                >
                  Tu donación en {entradas[0].hospital_nombre} ya está en tu historial y puede ayudar hasta a 3 pacientes.                </BloqueProtagonista>
              )}

              <TiraMetricas
                className="mb-6"
                metricas={[
                  { etiqueta: 'Donaciones registradas', valor: total },
                  { etiqueta: 'Tu impacto', valor: total === 0 ? '–' : 'Hasta ' + total * 3, detalle: total === 0 ? 'Tu primera donación puede ayudar hasta a 3 pacientes' : 'pacientes: cada donación se separa en glóbulos rojos, plasma y plaquetas' },
                  { etiqueta: 'Última donación', valor: total === 0 ? '–' : fecha(entradas[0].fecha_donacion), detalle: total === 0 ? undefined : entradas[0].hospital_nombre }
                ]}
              />

              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0 space-y-6">
                  <Panel titulo="Donaciones registradas" cuerpo="">
                    {total === 0 ? (
                      <Vacio titulo="Aún no tienes donaciones registradas" className="m-5">
                        Cuando un hospital registre tu donación aparecerá aquí con su sello de integridad.
                      </Vacio>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {entradas.map((e) => (
                          <li key={e.id} className="flex items-start gap-3 px-5 py-4 sm:items-center sm:gap-4">
                            <FichaSangre tipo={e.grupo_sanguineo} tamano="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900">Donación {folio(e.id, e.fecha_donacion)}</p>
                              <p className="text-sm text-gray-700">{e.hospital_nombre} · {nombreRegion(e.region)}</p>
                              <p className="text-sm text-gray-700 sm:hidden">{fecha(e.fecha_donacion)}</p>
                              <p className="mt-1 truncate font-mono text-xs text-gray-500" title={e.hash_actual}>Sello {selloLegible(e.hash_actual)}</p>
                            </div>
                            <p className="hidden shrink-0 text-right text-sm text-gray-700 sm:block">{fecha(e.fecha_donacion)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>

                  <SolicitudesArchivadas lista={archivadas} />
                </div>

                <div className="xl:sticky xl:top-8">
                  <BloqueIntegridad verificacion={datos.verificacion} paraDonante />
                </div>
              </div>
            </>
          );
        }}
      </EstadoConsulta>
    </>
  );
}

// Solicitudes de sangre que se cerraron sin completarse; ya no aparecen en Mis solicitudes
function SolicitudesArchivadas({ lista }) {
  if (lista.length === 0) return null;

  return (
    <Panel titulo="Solicitudes archivadas" detalle="Sangre que pediste y se canceló, caducó o el hospital marcó como falsa." cuerpo="">
      <ul className="divide-y divide-gray-100">
        {lista.map((s) => (
          <li key={s.id} className="flex items-start gap-3 px-5 py-4 sm:items-center sm:gap-4">
            <FichaSangre tipo={s.tipo_sangre} tamano="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                {s.para_si_mismo ? 'Para ti' : 'Para ' + s.paciente_nombre}
                <BadgeEstadoSolicitud estado={s.estado} />
              </p>
              <p className="text-sm text-gray-700">{s.hospital_nombre}</p>
              <p className="text-xs text-gray-600">
                Pedida el {fechaHora(s.fecha_solicitud)}{s.fecha_cierre && <> · Cerrada el {fechaHora(s.fecha_cierre)}</>}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
