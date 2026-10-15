import { registrarDonante, login } from './auth.service.js';
import { errorValidacion } from '../../utils/errores.js';
import { contextoDe } from '../auditoria/auditoria.service.js';

export async function registrar(req, res) {
  const usuario = await registrarDonante(req.body || {}, contextoDe(req));
  res.status(201).json({ ok: true, usuario });
}

export async function iniciarSesion(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw errorValidacion('Email y password requeridos');
  }
  const { token, usuario } = await login(email, password, contextoDe(req));
  res.json({ ok: true, token, usuario });
}

export function perfil(req, res) {
  // req.usuario lo pone el middleware verificarToken
  const { id, email, rol, id_hospital: idHospital } = req.usuario;
  const usuario = { id, email, rol };
  if (idHospital) usuario.id_hospital = idHospital;
  res.json({ ok: true, usuario });
}
