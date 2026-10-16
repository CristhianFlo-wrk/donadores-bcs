import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { prepararBaseDatos, crearDonante, loginDemo } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let donante;
let tokenHospital1;
let tokenHospital4;
let tokenAdmin;

before(async () => {
  await prepararBaseDatos();
  donante = await crearDonante(app, request, { id_tipo_sangre: 1 });
  await crearDonante(app, request, { id_tipo_sangre: 1 });
  await crearDonante(app, request, { id_tipo_sangre: 2 });
  await crearDonante(app, request, { id_tipo_sangre: 8 });
  tokenHospital1 = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenHospital4 = await loginDemo(app, request, 'hospital4@demo.donadores.mx', 'Hospital123');
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');

  // Hospital 1: una completada con una donacion y una activa critica. Hospital 4: una cancelada
  const completada = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 1, urgencia: 'urgente' });
  const idCompletada = completada.body.solicitud.id;
  await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idCompletada });
  const { rows } = await query('SELECT id FROM notificaciones WHERE id_solicitud = $1 AND id_donante = $2', [idCompletada, donante.id_donante]);
  await request(app).patch(`/api/notificaciones/${rows[0].id}/responder`).set(bearer(donante.token)).send({ respuesta: 'confirmada' });
  await request(app).patch(`/api/notificaciones/${rows[0].id}/donacion`).set(bearer(tokenHospital1));
  await request(app).patch(`/api/solicitudes/${idCompletada}/cerrar`).set(bearer(tokenHospital1)).send({ estado: 'completada' });

  await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'critica' });

  const cancelada = await request(app).post('/api/solicitudes').set(bearer(tokenHospital4)).send({ id_tipo_sangre: 3, urgencia: 'urgente' });
  await request(app).patch(`/api/solicitudes/${cancelada.body.solicitud.id}/cerrar`).set(bearer(tokenHospital4)).send({ estado: 'cancelada' });
});
after(cerrarPool);

describe('GET /api/reportes/dashboard (RF-09)', () => {
  it('admin ve el resumen de todo el sistema', async () => {
    const res = await request(app).get('/api/reportes/dashboard').set(bearer(tokenAdmin));
    assert.equal(res.status, 200);
    const { dashboard } = res.body;

    assert.equal(dashboard.id_hospital, null);
    assert.equal(dashboard.donantes.total, 4);
    assert.equal(dashboard.donantes.disponibles, 4);
    // El que dono hace segundos no es apto por la regla de 90 dias
    assert.equal(dashboard.donantes.aptos, 3);
    assert.deepEqual(dashboard.solicitudes, { total: 3, activas: 1, criticas_activas: 1, completadas: 1, canceladas: 1 });
    assert.equal(dashboard.donaciones_registradas, 1);
  });

  it('porcentaje por grupo sanguineo con los 8 tipos', async () => {
    const res = await request(app).get('/api/reportes/dashboard').set(bearer(tokenAdmin));
    const grupos = res.body.dashboard.donantes.por_grupo_sanguineo;
    assert.equal(grupos.length, 8);
    const porCodigo = Object.fromEntries(grupos.map((g) => [g.tipo_sangre, g]));
    assert.deepEqual(porCodigo['O-'], { tipo_sangre: 'O-', total: 2, porcentaje: 50 });
    assert.equal(porCodigo['O+'].porcentaje, 25);
    assert.equal(porCodigo['A-'].total, 0);
    assert.deepEqual(res.body.dashboard.donantes.por_region, [{ region: 'sur', total: 4 }]);
  });

  it('historial de solicitudes atendidas con donaciones', async () => {
    const res = await request(app).get('/api/reportes/dashboard').set(bearer(tokenAdmin));
    const atendidas = res.body.dashboard.solicitudes_atendidas;
    assert.equal(atendidas.length, 1);
    assert.equal(atendidas[0].tipo_sangre, 'O-');
    assert.equal(atendidas[0].donaciones, 1);
    assert.ok(atendidas[0].fecha_cierre);
  });

  it('un hospital solo ve sus solicitudes y donaciones', async () => {
    const h1 = await request(app).get('/api/reportes/dashboard').set(bearer(tokenHospital1));
    assert.equal(h1.body.dashboard.id_hospital, 1);
    assert.equal(h1.body.dashboard.solicitudes.total, 2);
    assert.equal(h1.body.dashboard.donaciones_registradas, 1);

    // Un hospital no puede pedir los datos de otro con ?id_hospital
    const h4 = await request(app).get('/api/reportes/dashboard?id_hospital=1').set(bearer(tokenHospital4));
    assert.equal(h4.body.dashboard.id_hospital, 4);
    assert.deepEqual(h4.body.dashboard.solicitudes, { total: 1, activas: 0, criticas_activas: 0, completadas: 0, canceladas: 1 });
    assert.equal(h4.body.dashboard.solicitudes_atendidas.length, 0);
  });

  it('admin filtra por hospital; donantes no tienen acceso', async () => {
    const res = await request(app).get('/api/reportes/dashboard?id_hospital=4').set(bearer(tokenAdmin));
    assert.equal(res.body.dashboard.solicitudes.canceladas, 1);
    assert.equal((await request(app).get('/api/reportes/dashboard?id_hospital=abc').set(bearer(tokenAdmin))).status, 400);
    assert.equal((await request(app).get('/api/reportes/dashboard').set(bearer(donante.token))).status, 403);
    assert.equal((await request(app).get('/api/reportes/dashboard')).status, 401);
  });
});
