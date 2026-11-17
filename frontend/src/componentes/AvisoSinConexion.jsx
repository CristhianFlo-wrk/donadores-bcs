import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

function useEnLinea() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  useEffect(() => {
    const conectado = () => setEnLinea(true);
    const desconectado = () => setEnLinea(false);
    window.addEventListener('online', conectado);
    window.addEventListener('offline', desconectado);
    return () => {
      window.removeEventListener('online', conectado);
      window.removeEventListener('offline', desconectado);
    };
  }, []);

  return enLinea;
}

export default function AvisoSinConexion() {
  const enLinea = useEnLinea();
  if (enLinea) return null;

  return (
    <div role="status" className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-gray-900 px-4 py-2 text-xs font-medium text-white">
      <WifiOff className="size-4" aria-hidden="true" />
      Sin conexión. Los datos se actualizarán al volver a conectarte.
    </div>
  );
}
