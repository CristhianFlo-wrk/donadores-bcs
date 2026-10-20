import { Download, Share, WifiOff } from 'lucide-react';
import { esAppInstalada, esIos, useEnLinea, useInstalacion } from '../pwa.js';
import { Boton, Tarjeta } from './ui.jsx';

export function AvisoSinConexion() {
  const enLinea = useEnLinea();
  if (enLinea) return null;

  return (
    <div role="status" className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-gray-900 px-4 py-2 text-xs font-medium text-white">
      <WifiOff className="size-4" aria-hidden="true" />
      Sin conexión. Los datos se actualizarán al volver a conectarte.
    </div>
  );
}

// Android/escritorio: boton nativo
export function TarjetaInstalar({ sinOpcion = null }) {
  const { disponible, instalar } = useInstalacion();
  if (esAppInstalada()) return sinOpcion;

  if (disponible) {
    return (
      <Tarjeta className="flex items-center gap-3">
        <Download className="size-5 shrink-0 text-acento-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">Instala la app</p>
          <p className="text-xs text-gray-500">Ábrela desde tu pantalla de inicio como cualquier otra app.</p>
        </div>
        <Boton variante="suave" className="px-3 py-1.5" onClick={instalar}>Instalar</Boton>
      </Tarjeta>
    );
  }

  if (esIos()) {
    return (
      <Tarjeta className="flex items-start gap-3">
        <Share className="size-5 shrink-0 text-acento-600" aria-hidden="true" />
        <p className="text-xs text-gray-600">
          <span className="block text-sm font-semibold text-gray-800">Instala la app en tu iPhone</span>
          En Safari toca Compartir y luego "Agregar a pantalla de inicio".
        </p>
      </Tarjeta>
    );
  }

  return sinOpcion;
}
