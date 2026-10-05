import 'dotenv/config';
import { getDb } from './src/config/database.js';

console.log('Verificando datos en los 3 nodos:\n');

['norte', 'centro', 'sur'].forEach(nodo => {
  const db = getDb(nodo);

  const usuarios = db.prepare('SELECT COUNT(*) as n FROM usuarios').get().n;
  const donantes = db.prepare('SELECT COUNT(*) as n FROM donantes').get().n;
  const bloques = db.prepare('SELECT COUNT(*) as n FROM historial_blockchain').get().n;

  console.log(`[${nodo.toUpperCase()}]`);
  console.log(`  Usuarios: ${usuarios}`);
  console.log(`  Donantes: ${donantes}`);
  console.log(`  Bloques:  ${bloques}`);
  console.log('');
});