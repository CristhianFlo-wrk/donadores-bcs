import { registrarDonante, login } from './auth.service.js';

export async function registrar(req, res) {
  try {
    const resultado = await registrarDonante(req.db, req.body);
    res.status(201).json({ ok: true, ...resultado });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function iniciarSesion(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email y password requeridos' });
    }
    const resultado = await login(req.db, email, password);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    res.status(401).json({ ok: false, error: error.message });
  }
}

export function perfil(req, res) {
  // req.usuario lo pone el middleware verificarToken
  res.json({
    ok: true,
    usuario: req.usuario,
    nodo: req.nodo.id
  });
}