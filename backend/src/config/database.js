import 'dotenv/config';
import pg from 'pg';

const { Pool, types } = pg;

// NUMERIC (latitud, longitud, peso_kg) 
types.setTypeParser(types.builtins.NUMERIC, (valor) => parseFloat(valor));
types.setTypeParser(types.builtins.INT8, (valor) => parseInt(valor, 10));
// DATE se deja como 'YYYY-MM-DD'; convertirlo a Date lo desplaza por zona horaria
types.setTypeParser(types.builtins.DATE, (valor) => valor);

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

export async function transaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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