import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Printer, X } from 'lucide-react';
import { auditoria } from '../../api/servicios.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { Aviso, Boton, Campo, EncabezadoPagina, Panel } from '../../componentes/ui.jsx';
import { selloLegible } from '../../utils/formato.js';

const formatoFechaLarga = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' });
const FORMULARIO_VACIO = { logs_hasta: '', donaciones_hasta: '', sello: '' };

// Lo que significa cada resultado, dicho para quien no es tecnico
function textoResultado(comprobacion, formulario) {
  const { resultado } = comprobacion;
  if (resultado === 'coincide') {
    return {
      tono: 'ok',
      titulo: 'La constancia coincide',
      detalle: 'Desde que se emitió, nadie modificó, insertó ni borró ninguno de los ' + comprobacion.registros_logs + ' registros de la bitácora ni de los '
        + comprobacion.registros_donaciones + ' del libro de donaciones que certifica.'
    };
  }
  if (resultado === 'cadena_alterada') {
    return {
      tono: 'error',
      titulo: 'Un registro de ese periodo fue alterado',
      detalle: 'El registro #' + comprobacion.id_roto + ', que la constancia certifica, cambió después de sellarse. Guarde esta pantalla como evidencia.'
    };
  }
  if (resultado === 'registro_inexistente') {
    return {
      tono: 'error',
      titulo: 'Faltan registros',
      detalle: 'El registro #' + formulario.logs_hasta + ' de la bitácora, que la constancia certifica, ya no existe. Revise que copió bien el número; si es correcto, se borraron registros.'
    };
  }
  return {
    tono: 'error',
    titulo: 'La constancia no coincide',
    detalle: 'La historia del sistema ya no produce el sello impreso. Primero revise que copió bien los números y el sello. Si son correctos, '
      + 'alguien reescribió registros de ese periodo, aunque las cadenas parezcan en orden dentro del sistema.'
  };
}

export default function Constancias() {
  const { usuario } = useSesion();
  const rutaAuditoria = usuario.rol === 'auditor' ? '/auditor' : '/admin/auditoria';
  const [constancia, setConstancia] = useState(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [errorEmision, setErrorEmision] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [comprobando, setComprobando] = useState(false);
  const [comprobacion, setComprobacion] = useState(null);
  const [errorComprobacion, setErrorComprobacion] = useState(null);

  async function emitir() {
    setEmitiendo(true);
    setErrorEmision(null);
    try {
      setConstancia((await auditoria.emitirConstancia()).constancia);
    } catch (e) {
      setErrorEmision(e.message);
    } finally {
      setEmitiendo(false);
    }
  }

  async function comprobar(evento) {
    evento?.preventDefault();
    setComprobacion(null);
    setErrorComprobacion(null);
    const sello = formulario.sello.replace(/[\s-]/g, '');
    if (!formulario.logs_hasta || formulario.donaciones_hasta === '' || sello.length < 16) {
      setErrorComprobacion('Escriba los dos números de registro y al menos los 16 caracteres del sello que aparecen en la constancia.');
      return;
    }
    setComprobando(true);
    try {
      const respuesta = await auditoria.comprobarConstancia({
        logs_hasta: Number(formulario.logs_hasta),
        donaciones_hasta: Number(formulario.donaciones_hasta),
        sello
      });
      setComprobacion(respuesta.comprobacion);
    } catch (e) {
      setErrorComprobacion(e.message);
    } finally {
      setComprobando(false);
    }
  }

  function usarConstancia() {
    setFormulario({ logs_hasta: String(constancia.logs_hasta), donaciones_hasta: String(constancia.donaciones_hasta), sello: selloLegible(constancia.sello) });
    setComprobacion(null);
    document.getElementById('comprobar-logs')?.focus();
  }

  const cambiar = (campo) => (e) => setFormulario((previo) => ({ ...previo, [campo]: e.target.value }));
  const mensaje = comprobacion && textoResultado(comprobacion, formulario);

  return (
    <>
      <div className="print:hidden">
        <EncabezadoPagina
          titulo="Constancias de integridad"
          volver={{ ruta: rutaAuditoria, texto: 'Auditoría' }}
        />

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-2">
          <Panel titulo="Emitir una constancia" detalle="Antes de emitirla se recalculan todos los sellos">
            <ol className="space-y-2 text-sm text-gray-700">
              <li>1. Emita la constancia: el sistema certifica los registros que hay en este momento.</li>
              <li>2. Imprímala, fírmela y entréguela a quien audita. La emisión queda en la bitácora con su folio.</li>
              <li>3. El día de la revisión, capture sus datos en «Comprobar una constancia».</li>
            </ol>
            {errorEmision && <Aviso className="mt-4">{errorEmision}</Aviso>}
            <Boton className="mt-4 w-full sm:w-auto" cargando={emitiendo} onClick={emitir}>Emitir constancia</Boton>
          </Panel>

          <Panel titulo="Comprobar una constancia" detalle="Use los datos impresos en la hoja">
            <form onSubmit={comprobar} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Campo etiqueta="Bitácora: hasta el registro #" id="comprobar-logs" type="number" inputMode="numeric" min="1" value={formulario.logs_hasta} onChange={cambiar('logs_hasta')} />
              <Campo etiqueta="Donaciones: hasta el registro #" id="comprobar-donaciones" type="number" inputMode="numeric" min="0" value={formulario.donaciones_hasta} onChange={cambiar('donaciones_hasta')} />
              <Campo
                etiqueta="Sello de la constancia"
                id="comprobar-sello"
                className="sm:col-span-2"
                placeholder="0000-0000-0000-0000"
                autoComplete="off"
                spellCheck="false"
                ayuda="Basta con los 16 caracteres grandes; también acepta el sello completo."
                value={formulario.sello}
                onChange={cambiar('sello')}
              />
              {errorComprobacion && <Aviso className="sm:col-span-2">{errorComprobacion}</Aviso>}
              <Boton type="submit" cargando={comprobando} className="w-full sm:col-span-2 sm:w-auto sm:justify-self-start">Comprobar</Boton>
            </form>

            {mensaje && (
              <div className={'mt-4 rounded-xl border p-4 ' + (mensaje.tono === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-900')} role="status">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {mensaje.tono === 'ok' ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
                  {mensaje.titulo}
                </p>
                <p className="mt-1 text-sm">{mensaje.detalle}</p>
                {comprobacion.alteracion_posterior && (
                  <p className="mt-2 text-sm">
                    Aparte: el registro #{comprobacion.alteracion_posterior}, posterior a esta constancia, sí fue alterado. Revíselo en <Link to={rutaAuditoria} className="font-semibold underline">Auditoría</Link>.
                  </p>
                )}
                <p className="mt-2 text-xs opacity-80">La comprobación quedó registrada en la bitácora.</p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {constancia && <HojaConstancia constancia={constancia} emisor={usuario.email} alComprobar={usarConstancia} />}
    </>
  );
}

// Hoja para imprimir: al imprimir solo sale esto (el resto de la pantalla lleva print:hidden)
function HojaConstancia({ constancia, emisor, alComprobar }) {
  return (
    <section aria-labelledby="titulo-constancia" className="mt-8 print:mt-0">
      <div className="mb-3 flex flex-wrap gap-2 print:hidden">
        <Boton onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" /> Imprimir constancia</Boton>
        <Boton variante="contorno" onClick={alComprobar}>Comprobar esta constancia</Boton>
      </div>

      <article className="mx-auto max-w-3xl rounded-xl border border-gray-300 bg-white p-6 text-gray-900 sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-300 pb-4">
          <div>
            <p className="text-xs font-semibold text-gray-600">Donadores BCS · Auditoría</p>
            <h2 id="titulo-constancia" className="font-display text-2xl font-bold">Constancia de integridad</h2>
          </div>
          <p className="text-right text-sm">
            <span className="block text-xs text-gray-600">Folio</span>
            <span className="font-mono text-lg font-semibold">#{constancia.folio}</span>
          </p>
        </header>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 print:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-600">Emitida</dt>
            <dd className="font-medium">{formatoFechaLarga.format(new Date(constancia.fecha))}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">Por</dt>
            <dd className="font-medium [overflow-wrap:anywhere]">{emisor}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">Bitácora: certifica hasta el registro</dt>
            <dd className="font-mono text-lg font-semibold">#{constancia.logs_hasta}</dd>
            <dd className="text-xs text-gray-600">{constancia.registros_logs} registros</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">Donaciones: certifica hasta el registro</dt>
            <dd className="font-mono text-lg font-semibold">#{constancia.donaciones_hasta}</dd>
            <dd className="text-xs text-gray-600">{constancia.registros_donaciones} registros</dd>
          </div>
        </dl>

        <div className="mt-6 rounded-lg border-2 border-gray-900 p-4 text-center">
          <p className="text-xs font-semibold text-gray-600">Sello de la constancia</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest sm:text-4xl">{selloLegible(constancia.sello)}</p>
          <p className="mt-2 break-all font-mono text-[11px] text-gray-600">{constancia.sello}</p>
        </div>

        <section className="mt-6 text-sm">
          <h3 className="font-semibold">Qué certifica</h3>
          <p className="mt-1 text-gray-700">
            Al emitirse, el sistema recalculó el sello de cada registro y todos cuadraban. El sello de arriba resume toda esa historia: si después
            alguien modifica, inserta o borra cualquiera de los registros certificados, el sistema ya no podrá producir este mismo sello.
          </p>
          <h3 className="mt-4 font-semibold">Cómo comprobarla</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-gray-700">
            <li>Entre a Auditoría, sección Constancias, y abra «Comprobar una constancia».</li>
            <li>Escriba los dos números de registro y el sello de esta hoja.</li>
            <li>Si el sistema responde «La constancia coincide», ninguno de esos registros cambió desde la fecha de emisión.</li>
          </ol>
        </section>

        <footer className="mt-12 grid gap-10 text-center text-xs text-gray-600 sm:grid-cols-2 print:grid-cols-2">
          <div className="border-t border-gray-400 pt-2">Firma de quien emite</div>
          <div className="border-t border-gray-400 pt-2">Firma de quien recibe (auditoría)</div>
        </footer>
      </article>
    </section>
  );
}
