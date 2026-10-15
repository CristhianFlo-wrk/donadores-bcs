import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool } from '../src/config/database.js';
import { prepararBaseDatos } from './helpers.js';

before(prepararBaseDatos);
after(cerrarPool);

describe('GET /api/ubicaciones', () => {
  it('lista los 5 municipios con su region', async () => {
    const res = await request(app).get('/api/ubicaciones/municipios');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.total, 5);
    const laPaz = res.body.municipios.find((m) => m.nombre === 'La Paz');
    assert.equal(laPaz.region, 'sur');
  });

  it('lista colonias de un municipio', async () => {
    const res = await request(app).get('/api/ubicaciones/colonias/4');
    assert.equal(res.status, 200);
    assert.equal(res.body.municipio, 'La Paz');
    assert.equal(res.body.total, 10);
  });

  it('404 si el municipio no existe', async () => {
    const res = await request(app).get('/api/ubicaciones/colonias/999');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { ok: false, error: 'Municipio no encontrado' });
  });

  it('400 si el id no es numerico', async () => {
    const res = await request(app).get('/api/ubicaciones/colonias/abc');
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  });

  it('lista los 8 tipos de sangre con booleanos reales', async () => {
    const res = await request(app).get('/api/ubicaciones/tipos-sangre');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 8);
    assert.equal(res.body.tipos[0].codigo, 'O-');
    assert.equal(res.body.tipos[0].es_donante_universal, true);
  });
});
