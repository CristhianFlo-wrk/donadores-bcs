import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { verificarLogs } from '../src/modules/auditoria/auditoria.service.js';
import { prepararBaseDatos, crearDonante, loginDemo, idColonia } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let donanteSur;
let donanteSur2;
let donanteCentro;
let tokenHospital1;
let tokenHospital2;
let tokenAdmin;
let idSolicitud;

const notificacionDe = (idDonante) =>
  query('SELECT * FROM notificaciones WHERE id_solicitud = $1 AND id_donante = $2', [idSolicitud, idDonante]).then((r) => r.rows[0]);

before(async () => {
  await prepararBaseDatos();
  donanteSur = await crearDonante(app, request, { id_tipo_sangre: 1 });
  donanteSur2 = await crearDonante(app, request, { id_tipo_sangre: 2 });
  donanteCentro = await crearDonante(app, request, { id_tipo_sangre: 1, id_colonia: await idColonia('Loreto Centro', 'Loreto') });
  tokenHospital1 = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenHospital2 = await loginDemo(app, request, 'hospital2@demo.donadores.mx', 'Hospital123');
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');

  // Hospital 1 (sur) pide O+: compatibles O- y O+
  const res = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'critica' });
  idSolicitud = res.body.solicitud.id;
});
after(cerrarPool);

describe('POST /api/notificaciones/notificar', () => {
  it('solo el hospital dueno o admin notifica', async () => {
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital2)).send({ id_solicitud: idSolicitud })).status, 403);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(donanteSur.token)).send({ id_solicitud: idSolicitud })).status, 403);
  });

  it('notifica por defecto solo a compatibles de la region del hospital', async () => {
    const res = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idSolicitud });
    assert.equal(res.status, 200);
    const ids = res.body.notificaciones.map((n) => n.id_donante).sort();
    assert.deepEqual(ids, [donanteSur.id_donante, donanteSur2.id_donante].sort());
    assert.ok(res.body.notificaciones.every((n) => n.modo === 'simulado'));
  });

  it('no duplica notificaciones y puede ampliar a todas las regiones', async () => {
    const otraVez = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idSolicitud });
    assert.equal(otraVez.body.notificaciones_enviadas, 0);

    const todas = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenAdmin))
      .send({ id_solicitud: idSolicitud, todas_las_regiones: true });
    assert.deepEqual(todas.body.notificaciones.map((n) => n.id_donante), [donanteCentro.id_donante]);
  });

  it('valida el body', async () => {
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({})).status, 400);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: 999 })).status, 404);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idSolicitud, region: 'x' })).status, 400);
  });
});

describe('donante: mis-notificaciones y responder', () => {
  it('el donante ve sus notificaciones', async () => {
    const res = await request(app).get('/api/notificaciones/mis-notificaciones').set(bearer(donanteSur.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.notificaciones[0].urgencia, 'critica');
  });

  it('no puede responder la notificacion de otro donante (bug 2)', async () => {
    const ajena = await notificacionDe(donanteSur2.id_donante);
    const res = await request(app).patch(`/api/notificaciones/${ajena.id}/responder`).set(bearer(donanteSur.token)).send({ respuesta: 'confirmada' });
    assert.equal(res.status, 404);
    assert.equal((await notificacionDe(donanteSur2.id_donante)).estado, 'enviada');
  });

  it('responde su propia notificacion y valida la respuesta', async () => {
    const propia = await notificacionDe(donanteSur.id_donante);
    assert.equal((await request(app).patch(`/api/notificaciones/${propia.id}/responder`).set(bearer(donanteSur.token)).send({ respuesta: 'quizas' })).status, 400);

    const res = await request(app).patch(`/api/notificaciones/${propia.id}/responder`).set(bearer(donanteSur.token)).send({ respuesta: 'confirmada' });
    assert.equal(res.status, 200);
    assert.equal(res.body.notificacion.estado, 'confirmada');

    const rechaza = await request(app).patch(`/api/notificaciones/${(await notificacionDe(donanteSur2.id_donante)).id}/responder`)
      .set(bearer(donanteSur2.token)).send({ respuesta: 'rechazada' });
    assert.equal(rechaza.status, 200);
  });

  it('hospitales no usan endpoints de donante', async () => {
    assert.equal((await request(app).get('/api/notificaciones/mis-notificaciones').set(bearer(tokenHospital1))).status, 403);
  });
});

describe('PATCH /api/notificaciones/:id/donacion', () => {
  it('no registra donacion de quien no confirmo', async () => {
    const rechazada = await notificacionDe(donanteSur2.id_donante);
    const res = await request(app).patch(`/api/notificaciones/${rechazada.id}/donacion`).set(bearer(tokenHospital1));
    assert.equal(res.status, 400);
  });

  it('otro hospital no puede registrarla', async () => {
    const confirmada = await notificacionDe(donanteSur.id_donante);
    assert.equal((await request(app).patch(`/api/notificaciones/${confirmada.id}/donacion`).set(bearer(tokenHospital2))).status, 403);
  });

  it('flujo completo: registra en la cadena, actualiza al donante y no se duplica', async () => {
    const confirmada = await notificacionDe(donanteSur.id_donante);
    const [a, b] = await Promise.all([
      request(app).patch(`/api/notificaciones/${confirmada.id}/donacion`).set(bearer(tokenHospital1)),
      request(app).patch(`/api/notificaciones/${confirmada.id}/donacion`).set(bearer(tokenHospital1))
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 400]);
    const ok = a.status === 200 ? a : b;
    assert.equal(ok.body.donacion.estado, 'donada');
    assert.equal(ok.body.donacion.historial.hash_anterior, '0'.repeat(64));

    const historial = await request(app).get('/api/auditoria/mi-historial').set(bearer(donanteSur.token));
    assert.equal(historial.body.total, 1);
    assert.equal(historial.body.verificacion.integra, true);
    assert.equal(historial.body.entradas[0].grupo_sanguineo, 'O-');
    assert.equal(historial.body.entradas[0].region, 'sur');

    const stats = await request(app).get('/api/donantes/stats').set(bearer(donanteSur.token));
    assert.equal(stats.body.stats.total_donaciones, 1);
    assert.equal(stats.body.stats.puede_donar, false);

    const perfil = await request(app).get('/api/donantes/perfil').set(bearer(donanteSur.token));
    assert.equal(perfil.body.perfil.ha_donado_antes, true);

    const solicitud = await request(app).get(`/api/solicitudes/${idSolicitud}`).set(bearer(tokenHospital1));
    assert.equal(solicitud.body.solicitud.metricas.donaciones, 1);
  });

  it('el donante que acaba de donar ya no aparece como candidato', async () => {
    const res = await request(app).get(`/api/solicitudes/${idSolicitud}/candidatos?region=sur`).set(bearer(tokenHospital1));
    assert.ok(!res.body.candidatos.some((c) => c.id_donante === donanteSur.id_donante));
  });

  it('bloquea una segunda donacion antes de 90 dias en otra solicitud', async () => {
    const nueva = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 1, urgencia: 'urgente' });
    const idNueva = nueva.body.solicitud.id;
    // Se inserta directo porque buscarCompatibles ya lo excluye por la regla de 90 dias
    const { rows } = await query(
      "INSERT INTO notificaciones (id_solicitud, id_donante, canal, estado) VALUES ($1, $2, 'push', 'confirmada') RETURNING id",
      [idNueva, donanteSur.id_donante]
    );
    const res = await request(app).patch(`/api/notificaciones/${rows[0].id}/donacion`).set(bearer(tokenHospital1));
    assert.equal(res.status, 409);
  });

  it('la cadena global de logs sigue integra despues de todo el flujo', async () => {
    const verificacion = await verificarLogs();
    assert.equal(verificacion.integra, true);
    const { rows } = await query("SELECT COUNT(*) AS total FROM auditoria_logs WHERE accion = 'DONACION_REGISTRADA'");
    assert.equal(rows[0].total, 1);
  });
});
