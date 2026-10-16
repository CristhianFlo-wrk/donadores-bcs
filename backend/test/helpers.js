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

// verificarToken busca el usuario en la base: el id debe existir (1 = admin demo de seeds.demo.pg.sql)
export function generarToken(datos = { id: 1, email: 'admin@demo.donadores.mx', rol: 'admin' }) {
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

// Atajo para tests que no prueban POST /api/auth/usuarios; se inserta directo
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

let contadorDonantes = 0;

// Registra un donante por API y devuelve su token. Cada llamada genera email y CURP unicos
export async function crearDonante(app, request, cambios = {}) {
  const n = contadorDonantes++;
  const sufijoCurp = 'ABCDEFGHIJ'[Math.floor(n / 10) % 10] + (n % 10);
  const datos = {
    email: `donante${n}@test.com`,
    password: 'MiPassword123',
    nombre_completo: `Donante Prueba ${n}`,
    curp: `DONA950520HBSRPN${sufijoCurp}`,
    fecha_nacimiento: '1995-05-20',
    id_tipo_sangre: 1,
    id_colonia: await idColonia('Centro', 'La Paz'),
    ...cambios
  };

  const registro = await request(app).post('/api/auth/registro').send(datos);
  if (registro.status !== 201) {
    throw new Error('crearDonante fallo: ' + JSON.stringify(registro.body));
  }

  const login = await request(app).post('/api/auth/login').send({ email: datos.email, password: datos.password });
  return { token: login.body.token, ...registro.body.usuario };
}

export async function loginDemo(app, request, email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}
