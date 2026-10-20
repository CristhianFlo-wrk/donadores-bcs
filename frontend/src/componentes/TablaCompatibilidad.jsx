import { Check } from 'lucide-react';
import { PUEDE_DONAR_A, TIPOS_SANGRE } from '../utils/compatibilidad.js';

export default function TablaCompatibilidad({ resaltar, modo = 'donante' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[520px] text-center text-sm">
        <caption className="sr-only">Compatibilidad de glóbulos rojos: filas donante, columnas receptor</caption>
        <thead>
          <tr className="border-b border-gray-200">
            <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Donante \ Receptor</th>
            {TIPOS_SANGRE.map((tipo) => (
              <th
                key={tipo}
                scope="col"
                className={'px-2 py-2.5 font-semibold ' + (modo === 'receptor' && tipo === resaltar ? 'bg-acento-50 text-acento-800' : 'text-gray-800')}
              >
                {tipo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIPOS_SANGRE.map((donante) => {
            const filaResaltada = modo === 'donante' && donante === resaltar;
            return (
              <tr key={donante} className={'border-b border-gray-100 last:border-0 ' + (filaResaltada ? 'bg-acento-50' : '')}>
                <th scope="row" className={'px-3 py-2 text-left font-semibold ' + (filaResaltada ? 'text-acento-800' : 'text-gray-800')}>{donante}</th>
                {TIPOS_SANGRE.map((receptor) => {
                  const compatible = PUEDE_DONAR_A[donante].includes(receptor);
                  const columnaResaltada = modo === 'receptor' && receptor === resaltar;
                  return (
                    <td key={receptor} className={'px-2 py-2 ' + (columnaResaltada ? 'bg-acento-50' : '')}>
                      {compatible ? (
                        <Check className="mx-auto size-4 text-acento-600" aria-label="Compatible" />
                      ) : (
                        <span className="text-gray-300" aria-label="No compatible">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
