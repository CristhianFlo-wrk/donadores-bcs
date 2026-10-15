import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { prepararBaseDatos, crearDonante, loginDemo } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let donante;
let tokenHospital1;
let tokenHospital2;
let tokenAdmin;

const crear = (token, datos) => request(app).post('/api/solicitudes').set(bearer(token)).send(datos);

before(async () => {
  await prepararBaseDatos();
  donante = await crearDonante(app, request, { id_tipo_sangre: 1 });
  tokenHospital1 = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenHospital2 = await loginDemo(app, request, 'hospital2@demo.donadores.mx', 'Hospital123');
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');
});
after(cerrarPool);

describe('POST /api/solicitudes', () => {
  it('un hospital crea solicitudes para su hospital tomado del token', async () => {
    const res = await crear(tokenHospital1, { id_tipo_sangre: 2, urgencia: 'critica', descripcion: 'Cirugia' });
    assert.equal(res.status, 201);
    assert.equal(res.body.solicitud.hospital.id, 1);
    assert.equal(res.body.solicitud.estado, 'activa');
    assert.equal(res.body.solicitud.tipo_sangre, 'O+');
    assert.deepEqual(res.body.solicitud.metricas, { total_notificados: 0, confirmaciones: 0, pendientes: 0, rechazadas: 0, donaciones: 0 });
  });

  it('403 si un hospital intenta crear para otro hospital', async () => {
    const res = await crear(tokenHospital1, { id_hospital: 2, id_tipo_sangre: 2, urgencia: 'urgente' });
    assert.equal(res.status, 403);
  });

  it('403 para donantes', async () => {
    const res = await crear(donante.token, { id_hospital: 1, id_tipo_sangre: 2, urgencia: 'urgente' });
    assert.equal(res.status, 403);
  });

  it('admin debe indicar id_hospital', async () => {
    assert.equal((await crear(tokenAdmin, { id_tipo_sangre: 2, urgencia: 'urgente' })).status, 400);
    const res = await crear(tokenAdmin, { id_hospital: 4, id_tipo_sangre: 2, urgencia: 'urgente' });
    assert.equal(res.status, 201);
    assert.equal(res.body.solicitud.hospital.region, 'centro');
  });

  it('valida urgencia, tipo de sangre y hospital', async () => {
    assert.equal((await crear(tokenHospital1, { id_tipo_sangre: 2, urgencia: 'normal' })).status, 400);
    assert.equal((await crear(tokenHospital1, { id_tipo_sangre: 99, urgencia: 'urgente' })).status, 400);
    assert.equal((await crear(tokenHospital1, { urgencia: 'urgente' })).status, 400);
    assert.equal((await crear(tokenAdmin, { id_hospital: 999, id_tipo_sangre: 2, urgencia: 'urgente' })).status, 400);
  });
});

describe('GET /api/solicitudes', () => {
  it('lista con criticas primero y filtra por estado, hospital y region', async () => {
    const todas = await request(app).get('/api/solicitudes').set(bearer(donante.token));
    assert.equal(todas.status, 200);
    assert.equal(todas.body.total, 2);
    assert.equal(todas.body.solicitudes[0].urgencia, 'critica');

    const centro = await request(app).get('/api/solicitudes?region=centro').set(bearer(donante.token));
    assert.equal(centro.body.total, 1);

    const hospital1 = await request(app).get('/api/solicitudes?id_hospital=1&estado=activa').set(bearer(donante.token));
    assert.equal(hospital1.body.total, 1);

    assert.equal((await request(app).get('/api/solicitudes?estado=otra').set(bearer(donante.token))).status, 400);
    assert.equal((await request(app).get('/api/solicitudes')).status, 401);
  });
});

describe('GET /api/solicitudes/:id', () => {
  it('el hospital dueno y admin ven notificaciones, otros no', async () => {
    const dueno = await request(app).get('/api/solicitudes/1').set(bearer(tokenHospital1));
    assert.ok(Array.isArray(dueno.body.solicitud.notificaciones));

    const admin = await request(app).get('/api/solicitudes/1').set(bearer(tokenAdmin));
    assert.ok(Array.isArray(admin.body.solicitud.notificaciones));

    const otro = await request(app).get('/api/solicitudes/1').set(bearer(tokenHospital2));
    assert.equal(otro.status, 200);
    assert.equal(otro.body.solicitud.notificaciones, undefined);

    const delDonante = await request(app).get('/api/solicitudes/1').set(bearer(donante.token));
    assert.equal(delDonante.body.solicitud.notificaciones, undefined);
  });

  it('404 si no existe', async () => {
    assert.equal((await request(app).get('/api/solicitudes/999').set(bearer(donante.token))).status, 404);
  });
});

describe('GET /api/solicitudes/:id/candidatos', () => {
  it('el hospital dueno ve candidatos compatibles', async () => {
    const res = await request(app).get('/api/solicitudes/1/candidatos').set(bearer(tokenHospital1));
    assert.equal(res.status, 200);
    assert.equal(res.body.tipo_sangre_requerido, 'O+');
    assert.ok(res.body.candidatos.some((c) => c.id_donante === donante.id_donante));
  });

  it('403 para otro hospital y para donantes', async () => {
    assert.equal((await request(app).get('/api/solicitudes/1/candidatos').set(bearer(tokenHospital2))).status, 403);
    assert.equal((await request(app).get('/api/solicitudes/1/candidatos').set(bearer(donante.token))).status, 403);
  });
});

describe('PATCH /api/solicitudes/:id/cerrar', () => {
  it('otro hospital no puede cerrarla', async () => {
    const res = await request(app).patch('/api/solicitudes/1/cerrar').set(bearer(tokenHospital2)).send({ estado: 'completada' });
    assert.equal(res.status, 403);
  });

  it('valida el estado', async () => {
    const res = await request(app).patch('/api/solicitudes/1/cerrar').set(bearer(tokenHospital1)).send({ estado: 'activa' });
    assert.equal(res.status, 400);
  });

  it('el dueno la cierra una sola vez', async () => {
    const res = await request(app).patch('/api/solicitudes/1/cerrar').set(bearer(tokenHospital1)).send({ estado: 'completada' });
    assert.equal(res.status, 200);
    assert.equal(res.body.solicitud.estado, 'completada');
    assert.ok(res.body.solicitud.fecha_cierre);

    const otraVez = await request(app).patch('/api/solicitudes/1/cerrar').set(bearer(tokenHospital1)).send({ estado: 'cancelada' });
    assert.equal(otraVez.status, 400);
    assert.match(otraVez.body.error, /completada/);
  });

  it('una solicitud cerrada ya no devuelve candidatos', async () => {
    const res = await request(app).get('/api/solicitudes/1/candidatos').set(bearer(tokenHospital1));
    assert.equal(res.status, 400);
  });

  it('dos cierres simultaneos: solo uno gana', async () => {
    const nueva = await crear(tokenHospital1, { id_tipo_sangre: 3, urgencia: 'urgente' });
    const id = nueva.body.solicitud.id;
    const [a, b] = await Promise.all([
      request(app).patch(`/api/solicitudes/${id}/cerrar`).set(bearer(tokenHospital1)).send({ estado: 'completada' }),
      request(app).patch(`/api/solicitudes/${id}/cerrar`).set(bearer(tokenHospital1)).send({ estado: 'cancelada' })
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 400]);
    const { rows } = await query('SELECT estado FROM solicitudes WHERE id = $1', [id]);
    assert.ok(['completada', 'cancelada'].includes(rows[0].estado));
  });
});
