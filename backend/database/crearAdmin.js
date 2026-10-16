import 'dotenv/config';
import { crearUsuario } from '../src/modules/auth/auth.service.js';
import { cerrarPool } from '../src/config/database.js';

const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;

try {
  if (!email || !password) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD');
  }
  const usuario = await crearUsuario({ email, password, rol: 'admin' });
  console.log('[OK] Admin creado: id=' + usuario.id + ' email=' + usuario.email);
} catch (error) {
  console.error('[ERROR] ' + error.message);
  process.exitCode = 1;
} finally {
  await cerrarPool();
}
