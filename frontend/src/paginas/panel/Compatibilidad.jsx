import { useState } from 'react';
import { EncabezadoPagina, FichaSangre, Panel } from '../../componentes/ui.jsx';
import TablaCompatibilidad from '../../componentes/TablaCompatibilidad.jsx';
import { PUEDE_DONAR_A, TIPOS_SANGRE, puedeRecibirDe } from '../../utils/compatibilidad.js';

// Referencia rapida para el personal: que tipos de donante cubren cada solicitud
export default function Compatibilidad() {
  const [tipo, setTipo] = useState('A+');
  const donantes = puedeRecibirDe(tipo);

  return (
    <>
      <EncabezadoPagina
        titulo="Compatibilidad sanguínea"
        descripcion="Compatibilidad de glóbulos rojos por grupo ABO y factor Rh. Es la misma tabla con la que el sistema decide a quién avisar de cada solicitud."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel titulo="Elige el tipo del paciente">
            <div className="grid grid-cols-4 gap-2 md:grid-cols-8" role="radiogroup" aria-label="Tipo de sangre del paciente">
              {TIPOS_SANGRE.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t}
                  onClick={() => setTipo(t)}
                  className={'rounded-lg py-3 text-center text-lg font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 ' +
                    (tipo === t ? 'bg-red-50 text-red-700 ring-2 ring-inset ring-red-600' : 'bg-white text-gray-800 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')}
                >
                  {t}
                </button>
              ))}
            </div>
          </Panel>

          <TablaCompatibilidad resaltar={tipo} modo="receptor" />
          <p className="text-xs text-gray-600">
            Filas: tipo del donante. Columnas: tipo del paciente. La columna del tipo elegido está resaltada. Antes de transfundir, la compatibilidad se confirma con pruebas de laboratorio.
          </p>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-8">
          <Panel titulo={'Un paciente ' + tipo + ' puede recibir de'}>
            <div className="flex flex-wrap gap-1.5">
              {donantes.map((t) => <FichaSangre key={t} tipo={t} tamano="md" />)}
            </div>
            <p className="mt-3 text-sm text-gray-700">
              {donantes.length === 1
                ? 'Solo donantes del mismo tipo: conviene ampliar el aviso a todo el estado.'
                : donantes.length + ' tipos de donante pueden cubrir esta solicitud.'}
            </p>
          </Panel>
          <Panel titulo={'Un donante ' + tipo + ' puede donar a'}>
            <div className="flex flex-wrap gap-1.5">
              {PUEDE_DONAR_A[tipo].map((t) => <FichaSangre key={t} tipo={t} tamano="md" />)}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
