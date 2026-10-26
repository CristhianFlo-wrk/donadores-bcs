import { auditoria } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { EncabezadoPagina, EstadoConsulta, Panel, TiraMetricas } from '../../componentes/ui.jsx';
import BloqueIntegridad from '../../componentes/BloqueIntegridad.jsx';

export default function Auditoria() {
  const consultaEstado = useConsulta(() => auditoria.estado());

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoría"
        descripcion="Cada donación y cada acción del sistema se encadena con SHA-256: alterar un registro rompe la cadena y se detecta al verificar."
      />

      <EstadoConsulta consulta={consultaEstado}>
        {({ estado }) => (
          <>
            <TiraMetricas
              className="mb-6"
              metricas={[
                { etiqueta: 'Donaciones encadenadas', valor: estado.total_donaciones },
                { etiqueta: 'Donantes con historial', valor: estado.donantes_con_historial },
                { etiqueta: 'Acciones en bitácora', valor: estado.total_logs }
              ]}
            />

            <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 space-y-6">
                <BloqueIntegridad verificacion={estado.verificacion_donaciones} titulo="Historial de donaciones: última donación encadenada" />
                <BloqueIntegridad verificacion={estado.verificacion_logs} titulo="Bitácora de acciones: último hash" />
              </div>

              <Panel titulo="Cómo funciona la cadena" className="xl:sticky xl:top-8">
                <ol className="space-y-4">
                  {[
                    ['Se registra el hecho', 'Una donación o una acción del sistema se guarda con sus datos y su fecha generada por PostgreSQL.'],
                    ['Se calcula su huella', 'El hash SHA-256 combina esos datos con el hash del registro anterior.'],
                    ['Se verifica', 'Al recalcular la cadena, cualquier registro alterado deja de coincidir y se detecta.']
                  ].map(([titulo, detalle], indice) => (
                    <li key={titulo} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-acento-50 text-xs font-semibold tabular-nums text-acento-700" aria-hidden="true">{indice + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{titulo}</p>
                        <p className="mt-0.5 text-sm text-gray-700">{detalle}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
            </div>
          </>
        )}
      </EstadoConsulta>
    </>
  );
}
