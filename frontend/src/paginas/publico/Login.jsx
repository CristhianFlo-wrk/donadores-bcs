import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import MarcoPublico from '../../componentes/MarcoPublico.jsx';
import { Aviso, Boton, Campo } from '../../componentes/ui.jsx';
import { rutaInicioPorRol, useSesion } from '../../contexto/SesionContext.jsx';

export default function Login() {
  const { usuario, iniciarSesion, sesionExpirada } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={rutaInicioPorRol(usuario.rol)} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const datos = await iniciarSesion(email.trim(), password);
      const destino = ubicacion.state?.desde;
      const inicio = rutaInicioPorRol(datos.rol);
      navegar(destino && destino.startsWith(inicio) ? destino : inicio, { replace: true });
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <MarcoPublico titulo="Iniciar sesión" subtitulo="Donantes, hospitales y administradores">
      {sesionExpirada && (
        <Aviso tono="aviso" className="mb-4">Tu sesión expiró. Vuelve a iniciar sesión.</Aviso>
      )}
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo
          etiqueta="Correo electrónico"
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Campo
          etiqueta="Contraseña"
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Aviso>{error}</Aviso>
        <Boton type="submit" cargando={enviando} className="w-full" disabled={!email || !password}>
          Entrar
        </Boton>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        ¿Quieres ser donante?{' '}
        <Link to="/registro" className="font-semibold text-red-600 hover:underline">Regístrate</Link>
      </p>

      {import.meta.env.DEV && (
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
          Demo: admin@demo.donadores.mx / Admin12345, hospital1@demo.donadores.mx / Hospital123
        </p>
      )}
    </MarcoPublico>
  );
}
