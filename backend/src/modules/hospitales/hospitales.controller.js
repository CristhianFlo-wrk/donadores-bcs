import { listarHospitales, obtenerHospital, crearHospital, editarHospital, cambiarActivoHospital } from './hospitales.service.js';
import { contextoDe } from '../auditoria/auditoria.service.js';
import { validarRegion } from '../../config/regiones.js';
import { parsearId } from '../../utils/errores.js';

// Los inactivos solo los ve el admin
export async function getHospitales(req, res) {
  const incluirInactivos = req.query.incluir_inactivos === 'true' && req.usuario.rol === 'admin';
  const hospitales = await listarHospitales({ region: validarRegion(req.query.region), incluirInactivos });
  res.json({ ok: true, total: hospitales.length, hospitales });
}

export async function getHospitalPorId(req, res) {
  const hospital = await obtenerHospital(parsearId(req.params.id));
  res.json({ ok: true, hospital });
}

export async function postHospital(req, res) {
  const hospital = await crearHospital(req.body || {}, contextoDe(req));
  res.status(201).json({ ok: true, hospital });
}

export async function patchHospital(req, res) {
  const hospital = await editarHospital(parsearId(req.params.id), req.body || {}, contextoDe(req));
  res.json({ ok: true, hospital });
}

export async function patchActivoHospital(req, res) {
  const { hospital, cuentasDesactivadas } = await cambiarActivoHospital(parsearId(req.params.id), req.body?.activo, contextoDe(req));
  res.json({ ok: true, hospital, cuentas_desactivadas: cuentasDesactivadas });
}
