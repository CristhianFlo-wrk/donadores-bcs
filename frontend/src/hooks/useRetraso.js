import { useEffect, useState } from 'react';

// Devuelve el valor cuando deja de cambiar durante ms: los buscadores no consultan la API en cada tecla.
// Vaciar el campo (o pulsar Limpiar) se aplica al instante
export function useRetraso(valor, ms = 400) {
  const [retrasado, setRetrasado] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);

  return valor === '' ? '' : retrasado;
}
