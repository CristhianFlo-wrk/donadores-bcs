import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODOS = ['norte', 'centro', 'sur'];
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const seeds = fs.readFileSync(path.join(__dirname, 'seeds.sql'), 'utf8');

console.log('Inicializando las 3 bases de datos...\n');

for (const nodo of NODOS) {
  const dbPath = path.join(__dirname, `${nodo}.db`);

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`BD anterior de ${nodo} eliminada`);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(schema);
  console.log(`Esquema creado en ${nodo}.db`);

  db.exec(seeds);
  console.log(`Datos semilla insertados en ${nodo}.db`);

  db.close();
  console.log(`Nodo ${nodo.toUpperCase()} listo\n`);
}

console.log('Los 3 nodos están listos');