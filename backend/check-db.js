import 'dotenv/config';
import { getDb } from './src/config/database.js';

const db = getDb('sur');

console.log('=== USUARIOS ===');
const usuarios = db.prepare('SELECT id, email, rol, activo FROM usuarios').all();
console.log(usuarios);

console.log('\n=== DONANTES ===');
const donantes = db.prepare(`
  SELECT id, id_usuario, substr(nombre_cifrado, 1, 40) as nombre_cifrado_corto,
         substr(curp_hash, 1, 16) as curp_hash_corto,
         id_tipo_sangre, id_colonia, id_nodo, peso_kg
  FROM donantes
`).all();
console.log(donantes);

console.log('\n=== BLOCKCHAIN ===');
const blockchain = db.prepare('SELECT id, id_donante_hash, id_nodo, substr(hash_actual, 1, 16) as hash_corto FROM historial_blockchain').all();
console.log(blockchain);