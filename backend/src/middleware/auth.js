import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

// Valida el JWT y luego confirma en la base que el usuario exista y siga activo.
export async function verificarToken(req, res, next) {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }

  let datos;
  try {
    datos = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }

  const { rows } = await query('SELECT id, email, rol, id_hospital, activo FROM usuarios WHERE id = $1', [datos.id]);
  const usuario = rows[0];
  if (!usuario || !usuario.activo) {
    return res.status(401).json({ ok: false, error: 'Usuario inexistente o desactivado' });
  }

  req.usuario = { id: usuario.id, email: usuario.email, rol: usuario.rol };
  if (usuario.rol === 'hospital') req.usuario.id_hospital = usuario.id_hospital;
  next();
}

export function soloRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ ok: false, error: 'Sin permisos para esta acción' });
    }
    next();
  };
}
