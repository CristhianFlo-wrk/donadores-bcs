import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'schema.pg.sql');
const seedsPath = path.join(__dirname, 'seeds.pg.sql');
const seedsDemoPath = path.join(__dirname, 'seeds.demo.pg.sql');

export async function ejecutarArchivo(client, ruta, etiqueta, silencioso) {
  const contenido = fs.readFileSync(ruta, 'utf8');
  try {
    await client.query(contenido);
    if (!silencioso) console.log('[OK] ' + etiqueta + ' ejecutado correctamente');
  } catch (error) {
    console.error('[ERROR] Fallo en ' + etiqueta + ': ' + error.message);
    throw error;
  }
}

export async function resetearSecuencias(client) {
  const tablas = ['tipos_sangre', 'municipios', 'hospitales'];
  for (const tabla of tablas) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), (SELECT MAX(id) FROM ${tabla}))`
    );
  }
}

export async function inicializarBaseDatos(connectionString, { silencioso = false } = {}) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('init-db bloqueado con NODE_ENV=production');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (!silencioso) console.log('[DB] Conexion a PostgreSQL establecida');
    await ejecutarArchivo(client, schemaPath, 'schema.pg.sql', silencioso);
    await ejecutarArchivo(client, seedsPath, 'seeds.pg.sql', silencioso);
    await ejecutarArchivo(client, seedsDemoPath, 'seeds.demo.pg.sql', silencioso);
    await resetearSecuencias(client);
    if (!silencioso) console.log('[OK] Secuencias reseteadas');
  } finally {
    await client.end();
  }
}

const esEjecucionDirecta = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  try {
    await inicializarBaseDatos(process.env.DATABASE_URL);
    console.log('[OK] Base de datos inicializada');
  } catch (error) {
    console.error('[ERROR] ' + error.message);
    process.exit(1);
  }
}
