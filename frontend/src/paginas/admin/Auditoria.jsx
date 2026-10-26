import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { auditoria } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { Aviso, Boton, Campo, EncabezadoPagina, EstadoConsulta, Panel, TiraMetricas } from '../../componentes/ui.jsx';
import BloqueIntegridad from '../../componentes/BloqueIntegridad.jsx';

const REGEX_HASH = /^[0-9a-f]{64}$/;

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
                <section aria-labelledby="titulo-cadena" className="rounded-xl bg-gray-950 p-5 text-white">
                  <h2 id="titulo-cadena" className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                    <ShieldCheck className="size-4 text-gray-400" aria-hidden="true" />
                    Último hash de la bitácora
                  </h2>
                  <p className="mt-3 break-all rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-gray-300">{estado.ultimo_hash_logs || 'Sin registros'}</p>
                  <p className="mt-3 text-xs text-gray-400">Cada nueva acción toma este hash como anterior; cambiar cualquier registro previo cambia todos los siguientes.</p>
                </section>

                <VerificarDonante />
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

function VerificarDonante() {
  const [hash, setHash] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [verificando, setVerificando] = useState(false);

  async function verificar(evento) {
    evento.preventDefault();
    setError('');
    setResultado(null);
    const valor = hash.trim().toLowerCase();
    if (!REGEX_HASH.test(valor)) return setError('El hash debe tener 64 caracteres hexadecimales.');

    setVerificando(true);
    try {
      const respuesta = await auditoria.verificar(valor);
      setResultado(respuesta.verificacion);
    } catch (e) {
      setError(e.message);
    } finally {
      setVerificando(false);
    }
  }

  return (
    <Panel titulo="Verificar el historial de un donante" detalle="Usa el hash del donante (HMAC de su CURP); nunca se muestra la CURP.">
      <form onSubmit={verificar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Campo
          etiqueta="Hash del donante"
          id="hash"
          className="flex-1"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          placeholder="64 caracteres hexadecimales"
          spellCheck={false}
        />
        <Boton type="submit" cargando={verificando}>Verificar</Boton>
      </form>
      <Aviso className="mt-3">{error}</Aviso>
      {resultado && (
        <div className="mt-4">
          <BloqueIntegridad verificacion={resultado} />
        </div>
      )}
    </Panel>
  );
}
