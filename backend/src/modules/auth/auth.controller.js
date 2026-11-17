import { registrarDonante, login, crearUsuario, listarUsuarios, cambiarActivoUsuario } from './auth.service.js';
import { errorValidacion, parsearId, parsearLimite } from '../../utils/errores.js';
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

export async function postUsuario(req, res) {
  const usuario = await crearUsuario(req.body || {}, contextoDe(req));
  res.status(201).json({ ok: true, usuario });
}

const VALORES_ACTIVO = { true: true, false: false };

export async function getUsuarios(req, res) {
  const correo = typeof req.query.correo === 'string' ? req.query.correo.trim() : '';
  if (correo.length > 150) {
    throw errorValidacion('correo admite como maximo 150 caracteres');
  }
  const { activo } = req.query;
  const filtraActivo = activo !== undefined && activo !== '';
  if (filtraActivo && !Object.hasOwn(VALORES_ACTIVO, activo)) {
    throw errorValidacion('activo debe ser "true" o "false"');
  }

  const usuarios = await listarUsuarios({
    rol: req.query.rol || null,
    limite: parsearLimite(req.query.limite),
    correo: correo || null,
    activo: filtraActivo ? VALORES_ACTIVO[activo] : null,
    idHospital: req.query.id_hospital ? parsearId(req.query.id_hospital, 'id_hospital') : null
  });
  res.json({ ok: true, total: usuarios.length, usuarios });
}

export async function patchActivo(req, res) {
  const { activo } = req.body || {};
  const usuario = await cambiarActivoUsuario(parsearId(req.params.id), activo, contextoDe(req));
  res.json({ ok: true, usuario });
}
