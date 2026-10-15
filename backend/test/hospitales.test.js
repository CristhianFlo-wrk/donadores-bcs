import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool } from '../src/config/database.js';
import { prepararBaseDatos, generarToken } from './helpers.js';

const auth = () => ({ Authorization: 'Bearer ' + generarToken() });

before(prepararBaseDatos);
after(cerrarPool);

describe('GET /api/hospitales', () => {
  it('401 sin token', async () => {
    const res = await request(app).get('/api/hospitales');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });

  it('lista los 8 hospitales con region', async () => {
    const res = await request(app).get('/api/hospitales').set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 8);
    assert.ok(res.body.hospitales.every((h) => ['norte', 'centro', 'sur'].includes(h.region)));
  });

  it('filtra por region', async () => {
    const res = await request(app).get('/api/hospitales?region=centro').set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
  });

  it('400 con region invalida', async () => {
    const res = await request(app).get('/api/hospitales?region=este').set(auth());
    assert.equal(res.status, 400);
  });

  it('obtiene un hospital por id', async () => {
    const res = await request(app).get('/api/hospitales/1').set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.hospital.institucion, 'IMSS');
  });

  it('404 si no existe y 400 si el id no es numerico', async () => {
    assert.equal((await request(app).get('/api/hospitales/999').set(auth())).status, 404);
    assert.equal((await request(app).get('/api/hospitales/abc').set(auth())).status, 400);
  });
});
