import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const conexiones = {};

export function getDb(nodoId) {
  if (conexiones[nodoId]) return conexiones[nodoId];

  const dbPath = path.join(__dirname, `../../database/${nodoId}.db`);
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  conexiones[nodoId] = db;
  return db;
}

export function cerrarTodas() {
  Object.values(conexiones).forEach(db => db.close());
}
