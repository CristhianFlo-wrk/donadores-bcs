import jwt from 'jsonwebtoken';

export function verificarToken(req, res, next) {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ ok: false, error: 'Token invalido o expirado' });
  }
}

// Usar despues de verificarToken
export function soloRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ ok: false, error: 'Sin permisos para esta accion' });
    }
    next();
  };
}
