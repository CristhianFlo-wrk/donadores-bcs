import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool } from '../src/config/database.js';
import { validarEntorno } from '../src/config/entorno.js';
import { reiniciarIntentos } from '../src/middleware/limiteIntentos.js';
import { prepararBaseDatos } from './helpers.js';

before(prepararBaseDatos);
after(cerrarPool);

const CLAVE = 'a'.repeat(64);
const entornoValido = { DATABASE_URL: 'postgresql://x', AES_KEY: CLAVE, HASH_KEY: CLAVE, JWT_SECRET: 'corto' };

describe('validarEntorno', () => {
  it('acepta un entorno de desarrollo completo', () => {
    assert.deepEqual(validarEntorno(entornoValido), []);
  });

  it('detecta variables faltantes y llaves mal formadas', () => {
    const errores = validarEntorno({ ...entornoValido, DATABASE_URL: '', AES_KEY: 'abc' });
    assert.equal(errores.length, 2);
    assert.match(errores[0], /DATABASE_URL/);
    assert.match(errores[1], /AES_KEY/);
  });

  it('en produccion exige JWT_SECRET largo y CORS_ORIGIN', () => {
    const errores = validarEntorno({ ...entornoValido, NODE_ENV: 'production' });
    assert.equal(errores.length, 2);
    const ok = validarEntorno({ ...entornoValido, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32), CORS_ORIGIN: 'https://app.vercel.app' });
    assert.deepEqual(ok, []);
  });
});

describe('limite de logins fallidos', () => {
  it('bloquea con 429 despues de N fallos desde la misma IP', async () => {
    process.env.LOGIN_MAX_INTENTOS = '3';
    reiniciarIntentos();

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: 'admin@demo.donadores.mx', password: 'mala' });
      assert.equal(res.status, 401);
    }

    // Bloqueado aunque ahora la password sea correcta
    const bloqueado = await request(app).post('/api/auth/login').send({ email: 'admin@demo.donadores.mx', password: 'Admin12345' });
    assert.equal(bloqueado.status, 429);
    assert.equal(bloqueado.body.ok, false);
    assert.ok(Number(bloqueado.headers['retry-after']) > 0);

    reiniciarIntentos();
    const despues = await request(app).post('/api/auth/login').send({ email: 'admin@demo.donadores.mx', password: 'Admin12345' });
    assert.equal(despues.status, 200);
  });

  it('los logins correctos no consumen intentos', async () => {
    reiniciarIntentos();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: 'admin@demo.donadores.mx', password: 'Admin12345' });
      assert.equal(res.status, 200);
    }
    delete process.env.LOGIN_MAX_INTENTOS;
  });
});
