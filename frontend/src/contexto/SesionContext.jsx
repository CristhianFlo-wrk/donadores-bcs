import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../api/servicios.js';
import { guardarToken, leerToken, registrarAlExpirarSesion } from '../api/cliente.js';

const SesionContext = createContext(null);

export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => Boolean(leerToken()));
  const [sesionExpirada, setSesionExpirada] = useState(false);
  // Hay token guardado pero el servidor no respondio: no se manda al login
  const [sinConexion, setSinConexion] = useState(false);

  const cerrarSesion = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
    setSinConexion(false);
  }, []);

  useEffect(() => {
    registrarAlExpirarSesion(() => {
      guardarToken(null);
      setUsuario(null);
      setSesionExpirada(true);
    });
  }, []);

  // Al abrir la app con un token guardado se confirma con el backend que siga vigente
  const verificarSesion = useCallback(() => {
    if (!leerToken()) {
      setCargando(false);
      return;
    }
    setCargando(true);
    auth.perfil()
      .then((respuesta) => {
        setUsuario(respuesta.usuario);
        setSinConexion(false);
      })
      // Un 401 ya borra el token en alExpirarSesion; si sigue guardado fue la red o el servidor
      .catch(() => setSinConexion(Boolean(leerToken())))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    verificarSesion();
  }, [verificarSesion]);

  // Al volver la senal se reintenta solo, sin recargar la pagina
  useEffect(() => {
    if (!sinConexion) return undefined;
    window.addEventListener('online', verificarSesion);
    return () => window.removeEventListener('online', verificarSesion);
  }, [sinConexion, verificarSesion]);

  const iniciarSesion = useCallback(async (email, password) => {
    const respuesta = await auth.login(email, password);
    guardarToken(respuesta.token);
    setSesionExpirada(false);
    setSinConexion(false);
    setUsuario(respuesta.usuario);
    return respuesta.usuario;
  }, []);

  const valor = useMemo(() => ({
    usuario,
    cargando,
    sesionExpirada,
    sinConexion,
    verificarSesion,
    iniciarSesion,
    cerrarSesion
  }), [usuario, cargando, sesionExpirada, sinConexion, verificarSesion, iniciarSesion, cerrarSesion]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  return useContext(SesionContext);
}

export function rutaInicioPorRol(rol) {
  if (rol === 'donante') return '/donante';
  if (rol === 'hospital') return '/hospital';
  if (rol === 'admin') return '/admin';
  if (rol === 'auditor') return '/auditor';
  return '/login';
}
