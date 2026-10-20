import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../api/servicios.js';
import { guardarToken, leerToken, registrarAlExpirarSesion } from '../api/cliente.js';

const SesionContext = createContext(null);

export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(() => Boolean(leerToken()));
  const [sesionExpirada, setSesionExpirada] = useState(false);

  const cerrarSesion = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    registrarAlExpirarSesion(() => {
      guardarToken(null);
      setUsuario(null);
      setSesionExpirada(true);
    });
  }, []);

  // Al abrir la app con un token guardado se confirma con el backend que siga vigente
  useEffect(() => {
    if (!leerToken()) return;
    auth.perfil()
      .then((respuesta) => setUsuario(respuesta.usuario))
      .catch(() => guardarToken(null))
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const respuesta = await auth.login(email, password);
    guardarToken(respuesta.token);
    setSesionExpirada(false);
    setUsuario(respuesta.usuario);
    return respuesta.usuario;
  }, []);

  const valor = useMemo(() => ({
    usuario,
    cargando,
    sesionExpirada,
    iniciarSesion,
    cerrarSesion
  }), [usuario, cargando, sesionExpirada, iniciarSesion, cerrarSesion]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  return useContext(SesionContext);
}

export function rutaInicioPorRol(rol) {
  if (rol === 'donante') return '/donante';
  if (rol === 'hospital') return '/hospital';
  if (rol === 'admin') return '/admin';
  return '/login';
}
