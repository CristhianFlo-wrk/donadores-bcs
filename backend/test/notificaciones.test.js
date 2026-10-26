import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { verificarLogs } from '../src/modules/auditoria/auditoria.service.js';
import { buscarCompatibles } from '../src/modules/donantes/donantes.service.js';
import { prepararBaseDatos, crearDonante, loginDemo, idColonia } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let donanteSur;
let donanteSur2;
let donanteCentro;
let tokenHospital1;
let tokenHospital2;
let tokenAdmin;
let idSolicitud;

// La respuesta de notificar no trae id_donante: se busca en la base a quien se aviso
const donantesAvisados = (res) =>
  query('SELECT id_donante FROM notificaciones WHERE id = ANY($1::int[])', [res.body.notificaciones.map((n) => n.id)])
    .then((r) => r.rows.map((f) => f.id_donante));

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

  // Hospital 1 (sur) pide O+ urgente: compatibles O- y O+, por defecto solo region sur
  const res = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'urgente' });
  idSolicitud = res.body.solicitud.id;
});
after(cerrarPool);

describe('POST /api/notificaciones/notificar', () => {
  it('solo el hospital dueno o admin notifica', async () => {
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital2)).send({ id_solicitud: idSolicitud })).status, 403);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(donanteSur.token)).send({ id_solicitud: idSolicitud })).status, 403);
  });

  it('urgente: notifica por defecto solo a compatibles de la region del hospital, por push y SMS', async () => {
    const res = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idSolicitud });
    assert.equal(res.status, 200);
    assert.equal(res.body.alcance, 'sur');
    const ids = (await donantesAvisados(res)).sort();
    assert.deepEqual(ids, [donanteSur.id_donante, donanteSur2.id_donante].sort());
    assert.ok(res.body.notificaciones.every((n) => n.id_donante === undefined));
    assert.ok(res.body.notificaciones.every((n) => n.modo === 'simulado' && n.sms === 'simulado'));
  });

  it('no duplica notificaciones y puede ampliar a todas las regiones', async () => {
    const otraVez = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idSolicitud });
    assert.equal(otraVez.body.notificaciones_enviadas, 0);

    const todas = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenAdmin))
      .send({ id_solicitud: idSolicitud, todas_las_regiones: true });
    assert.deepEqual(await donantesAvisados(todas), [donanteCentro.id_donante]);
  });

  it('valida el body', async () => {
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({})).status, 400);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: 999 })).status, 404);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idSolicitud, region: 'x' })).status, 400);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: 'abc' })).status, 400);
  });

  it('critica: sin region explicita notifica en todo el estado', async () => {
    const critica = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 1, urgencia: 'critica' });
    const res = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: critica.body.solicitud.id });
    assert.equal(res.body.alcance, 'todas');
    const ids = await donantesAvisados(res);
    assert.ok(ids.includes(donanteCentro.id_donante));
    assert.ok(ids.includes(donanteSur.id_donante));
    await request(app).patch(`/api/solicitudes/${critica.body.solicitud.id}/cerrar`).set(bearer(tokenHospital1)).send({ estado: 'cancelada' });
  });
});

describe('donante: mis-notificaciones y responder', () => {
  it('el donante ve sus notificaciones', async () => {
    const res = await request(app).get('/api/notificaciones/mis-notificaciones').set(bearer(donanteSur.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    const deLaUrgente = res.body.notificaciones.find((n) => n.id_solicitud === idSolicitud);
    assert.equal(deLaUrgente.urgencia, 'urgente');
    assert.equal(deLaUrgente.solicitud_estado, 'activa');
  });

  it('no puede responder la notificacion de otro donante', async () => {
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

  it('la confirmacion y el rechazo quedan en auditoria_logs', async () => {
    const { rows } = await query(
      "SELECT accion, id_usuario FROM auditoria_logs WHERE accion IN ('ASISTENCIA_CONFIRMADA', 'ASISTENCIA_RECHAZADA') ORDER BY id"
    );
    assert.deepEqual(rows.map((r) => r.accion), ['ASISTENCIA_CONFIRMADA', 'ASISTENCIA_RECHAZADA']);
    assert.equal(rows[0].id_usuario, donanteSur.id_usuario);
  });

  it('el hospital ve las confirmaciones de sus solicitudes activas sin datos del donante', async () => {
    const confirmada = await notificacionDe(donanteSur.id_donante);
    const res = await request(app).get('/api/notificaciones/confirmadas').set(bearer(tokenHospital1));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.notificaciones.map((n) => n.id), [confirmada.id]);
    assert.equal(res.body.notificaciones[0].tipo_sangre, 'O+');
    assert.equal(res.body.notificaciones[0].id_donante, undefined);

    assert.equal((await request(app).get('/api/notificaciones/confirmadas').set(bearer(tokenHospital2))).body.total, 0);
    assert.equal((await request(app).get('/api/notificaciones/confirmadas').set(bearer(donanteSur.token))).status, 403);

    // El detalle de la solicitud tampoco expone al donante
    const detalle = await request(app).get(`/api/solicitudes/${idSolicitud}`).set(bearer(tokenHospital1));
    assert.ok(detalle.body.solicitud.notificaciones.length > 0);
    assert.ok(detalle.body.solicitud.notificaciones.every((n) => n.id_donante === undefined));
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
    const candidatos = await buscarCompatibles(2, { region: 'sur' });
    assert.ok(candidatos.length > 0);
    assert.ok(!candidatos.some((c) => c.id_donante === donanteSur.id_donante));
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

  it('se puede registrar la donacion despues de cerrar la solicitud como completada', async () => {
    const pendiente = await notificacionDe(donanteCentro.id_donante);
    await request(app).patch(`/api/notificaciones/${pendiente.id}/responder`).set(bearer(donanteCentro.token)).send({ respuesta: 'confirmada' });
    const cierre = await request(app).patch(`/api/solicitudes/${idSolicitud}/cerrar`).set(bearer(tokenHospital1)).send({ estado: 'completada' });
    assert.equal(cierre.status, 200);

    const res = await request(app).patch(`/api/notificaciones/${pendiente.id}/donacion`).set(bearer(tokenHospital1));
    assert.equal(res.status, 200);
    assert.equal(res.body.donacion.estado, 'donada');
  });

  it('no se registra donacion en una solicitud cancelada', async () => {
    const nueva = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'urgente' });
    const idNueva = nueva.body.solicitud.id;
    const { rows } = await query(
      "INSERT INTO notificaciones (id_solicitud, id_donante, canal, estado) VALUES ($1, $2, 'push', 'confirmada') RETURNING id",
      [idNueva, donanteSur2.id_donante]
    );
    await request(app).patch(`/api/solicitudes/${idNueva}/cerrar`).set(bearer(tokenHospital1)).send({ estado: 'cancelada' });
    const res = await request(app).patch(`/api/notificaciones/${rows[0].id}/donacion`).set(bearer(tokenHospital1));
    assert.equal(res.status, 400);
  });

  it('la cadena global de logs sigue integra despues de todo el flujo', async () => {
    const verificacion = await verificarLogs();
    assert.equal(verificacion.integra, true);
    const { rows } = await query("SELECT COUNT(*) AS total FROM auditoria_logs WHERE accion = 'DONACION_REGISTRADA'");
    assert.equal(rows[0].total, 2);
  });
});

describe('GET /api/auditoria/notificacion/:id', () => {
  it('el hospital dueno verifica el historial del donante notificado sin conocer su hash', async () => {
    const donada = await notificacionDe(donanteSur.id_donante);
    const res = await request(app).get(`/api/auditoria/notificacion/${donada.id}`).set(bearer(tokenHospital1));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.verificacion.integra, true);
    assert.equal(JSON.stringify(res.body).includes('id_donante_hash'), false);

    const admin = await request(app).get(`/api/auditoria/notificacion/${donada.id}`).set(bearer(tokenAdmin));
    assert.equal(admin.status, 200);
  });

  it('otro hospital y donantes no pueden; 404 si no existe', async () => {
    const donada = await notificacionDe(donanteSur.id_donante);
    assert.equal((await request(app).get(`/api/auditoria/notificacion/${donada.id}`).set(bearer(tokenHospital2))).status, 403);
    assert.equal((await request(app).get(`/api/auditoria/notificacion/${donada.id}`).set(bearer(donanteSur.token))).status, 403);
    assert.equal((await request(app).get('/api/auditoria/notificacion/9999').set(bearer(tokenHospital1))).status, 404);
  });
});

describe('volver a notificar', () => {
  it('avisa a los compatibles que faltan en lugar de repetir los mismos', async () => {
    // Aptos O-/O+ del sur en este punto: donanteSur2 y estos dos (donanteSur ya dono)
    await crearDonante(app, request, { id_tipo_sangre: 1 });
    await crearDonante(app, request, { id_tipo_sangre: 2 });
    const nueva = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'urgente' });
    const idNueva = nueva.body.solicitud.id;

    const enviadas = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idNueva, limite: 1 });
      enviadas.push(res.body.notificaciones_enviadas);
    }
    assert.deepEqual(enviadas, [1, 1, 1, 0]);
  });
});
