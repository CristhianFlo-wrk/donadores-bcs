import { useCallback, useEffect, useRef, useState } from 'react';

// Ejecuta una consulta a la API y expone datos, error, cargando y recargar.
// Con intervaloMs vuelve a consultar en segundo plano (polling) sin mostrar el estado de carga
export function useConsulta(funcion, dependencias = [], { intervaloMs = 0 } = {}) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const funcionRef = useRef(funcion);
  funcionRef.current = funcion;
  const turno = useRef(0);

  // Solo la consulta mas reciente escribe: una respuesta lenta de filtros viejos no pisa a la nueva
  const ejecutar = useCallback(async (silencioso = false) => {
    const miTurno = ++turno.current;
    if (!silencioso) setCargando(true);
    try {
      const resultado = await funcionRef.current();
      if (miTurno !== turno.current) return;
      setDatos(resultado);
      setError(null);
    } catch (e) {
      // Los datos viejos eran de otros parametros (otro municipio, otro filtro): no se dejan a la vista
      if (!silencioso && miTurno === turno.current) {
        setDatos(null);
        setError(e);
      }
    } finally {
      if (miTurno === turno.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    ejecutar();
  }, dependencias);

  useEffect(() => {
    if (!intervaloMs) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ejecutar(true);
    }, intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs, ejecutar]);

  const recargar = useCallback(() => ejecutar(true), [ejecutar]);

  return { datos, error, cargando, recargar };
}
