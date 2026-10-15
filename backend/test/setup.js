// Se carga con --import antes de cada archivo de test (ver script "test" en package.json)
// Redirige DATABASE_URL a una base <nombre>_test para no tocar la base de desarrollo
import 'dotenv/config';

process.env.NODE_ENV = 'test';

const urlOriginal = process.env.DATABASE_URL;
if (!urlOriginal) {
  throw new Error('[ERROR] DATABASE_URL no configurada en .env');
}

const urlPrueba = new URL(process.env.TEST_DATABASE_URL || urlOriginal);
if (!process.env.TEST_DATABASE_URL) {
  urlPrueba.pathname = urlPrueba.pathname + '_test';
}

if (!urlPrueba.pathname.endsWith('_test')) {
  throw new Error('[ERROR] La base de pruebas debe terminar en _test');
}

process.env.DATABASE_URL_ADMIN = urlOriginal;
process.env.DATABASE_URL = urlPrueba.toString();
