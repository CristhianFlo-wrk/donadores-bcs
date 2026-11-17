// Se carga con --import antes de cada archivo de test (ver script "test" en package.json)
// Redirige DATABASE_URL a una base <nombre>_test para no tocar la base de desarrollo
import 'dotenv/config';

process.env.NODE_ENV = 'test';

// Asignacion directa: un .env local con limites bajos no debe romper la suite
process.env.LIMITE_GENERAL_POR_MINUTO = '100000';
process.env.LIMITE_REGISTRO_POR_HORA = '100000';
process.env.LIMITE_SOLICITUDES_POR_HORA = '100000';

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
