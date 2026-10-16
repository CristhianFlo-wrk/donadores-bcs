import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { ejecutarArchivo, resetearSecuencias } from './initDB.js';


const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

try {
  await client.connect();
  console.log('[DB] Conexion a PostgreSQL establecida');
  await client.query('BEGIN');
  await ejecutarArchivo(client, path.join(__dirname, 'schema.pg.prod.sql'), 'schema.pg.prod.sql');
  await ejecutarArchivo(client, path.join(__dirname, 'seeds.pg.sql'), 'seeds.pg.sql');
  await resetearSecuencias(client);
  await client.query('COMMIT');
  console.log('[OK] Base de produccion inicializada');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('[ERROR] ' + error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
