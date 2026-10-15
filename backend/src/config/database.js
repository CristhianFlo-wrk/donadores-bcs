import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (error) => {
  console.error('[ERROR] Pool de PostgreSQL: ' + error.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function probarConexion() {
  try {
    const result = await pool.query('SELECT NOW() AS ahora');
    console.log('[DB] Conexion a PostgreSQL establecida: ' + result.rows[0].ahora.toISOString());
    return true;
  } catch (error) {
    console.error('[ERROR] No se pudo conectar a PostgreSQL: ' + error.message);
    return false;
  }
}

export async function cerrarPool() {
  await pool.end();
}

export default pool;