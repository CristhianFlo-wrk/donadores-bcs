import pg from 'pg';
import jwt from 'jsonwebtoken';
import { inicializarBaseDatos } from '../database/initDB.js';
import { query } from '../src/config/database.js';
import { hashPassword } from '../src/utils/crypto.js';

// Crea la base de pruebas si no existe y la deja con schema + seeds limpios
export async function prepararBaseDatos() {
  const nombreBase = new URL(process.env.DATABASE_URL).pathname.slice(1);
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
  await admin.connect();
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombreBase]);
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${nombreBase}"`);
    }
  } finally {
    await admin.end();
  }
  await inicializarBaseDatos(process.env.DATABASE_URL, { silencioso: true });
}

export function generarToken(datos = { id: 1, email: 'prueba@test.com', rol: 'donante' }) {
  return jwt.sign(datos, process.env.JWT_SECRET, { expiresIn: '1h' });
}

export async function idColonia(nombreColonia, nombreMunicipio) {
  const { rows } = await query(`
    SELECT c.id FROM colonias c
    JOIN municipios m ON c.id_municipio = m.id
    WHERE c.nombre = $1 AND m.nombre = $2
  `, [nombreColonia, nombreMunicipio]);
  return rows[0].id;
}

// No hay endpoint para crear usuarios hospital; se insertan directo
export async function crearUsuarioHospital(email, password, idHospital) {
  const { rows } = await query(`
    INSERT INTO usuarios (email, password_hash, rol, id_hospital)
    VALUES ($1, $2, 'hospital', $3)
    RETURNING id
  `, [email, await hashPassword(password), idHospital]);
  return rows[0].id;
}

export async function contarFilas(tabla) {
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM ${tabla}`);
  return rows[0].total;
}
