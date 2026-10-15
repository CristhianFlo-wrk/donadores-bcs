import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'schema.pg.sql');
const seedsPath = path.join(__dirname, 'seeds.pg.sql');

async function ejecutarArchivo(client, ruta, etiqueta) {
  const contenido = fs.readFileSync(ruta, 'utf8');
  try {
    await client.query(contenido);
    console.log('[OK] ' + etiqueta + ' ejecutado correctamente');
  } catch (error) {
    console.error('[ERROR] Fallo en ' + etiqueta + ': ' + error.message);
    throw error;
  }
}

async function resetearSecuencias(client) {
  const tablas = ['tipos_sangre', 'municipios', 'hospitales'];
  for (const tabla of tablas) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), (SELECT MAX(id) FROM ${tabla}))`
    );
  }
  console.log('[OK] Secuencias reseteadas');
}

async function initDB() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('[DB] Conexion a PostgreSQL establecida');

    await ejecutarArchivo(client, schemaPath, 'schema.pg.sql');
    await ejecutarArchivo(client, seedsPath, 'seeds.pg.sql');
    await resetearSecuencias(client);

    console.log('[OK] Base de datos inicializada');
  } catch (error) {
    console.error('[ERROR] ' + error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDB();