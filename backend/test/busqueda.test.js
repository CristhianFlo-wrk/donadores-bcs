import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { prepararBaseDatos, crearDonante, loginDemo } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let tokenHospital1;
let tokenHospital2;
let tokenAdmin;
let idCadera;
let idProgramada;
let idCaderaHospital2;
let idCiudadana;
let idNotificacion;
let hoy;

const crear = (token, datos) => request(app).post('/api/solicitudes').set(bearer(token)).send(datos);
const buscar = (token, filtros) => request(app).get('/api/solicitudes').query(filtros).set(bearer(token));
const ids = (res) => res.body.solicitudes.map((s) => s.id).sort((a, b) => a - b);

before(async () => {
  await prepararBaseDatos();
  tokenHospital1 = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenHospital2 = await loginDemo(app, request, 'hospital2@demo.donadores.mx', 'Hospital123');
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');

  // O- dona a O+: este donante recibe el aviso de la solicitud de cadera
  await crearDonante(app, request, { id_tipo_sangre: 1 });
  idCadera = (await crear(tokenHospital1, { id_tipo_sangre: 2, urgencia: 'critica', descripcion: 'Cirugía de cadera' })).body.solicitud.id;
  idProgramada = (await crear(tokenHospital1, { id_tipo_sangre: 3, urgencia: 'normal' })).body.solicitud.id;
  idCaderaHospital2 = (await crear(tokenHospital2, { id_tipo_sangre: 3, urgencia: 'urgente', descripcion: 'Fractura de CADERA' })).body.solicitud.id;

  const envio = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idCadera });
  idNotificacion = envio.body.notificaciones[0].id;

  const autor = await crearDonante(app, request, { id_tipo_sangre: 8 });
  const ciudadana = await request(app).post('/api/solicitudes/ciudadana').set(bearer(autor.token)).send({
    id_hospital: 1, id_tipo_sangre: 1, urgencia: 'urgente', consentimiento: true, para_si_mismo: false,
    paciente_nombre: 'María José Núñez'
  });
  idCiudadana = ciudadana.body.solicitud.id;

  hoy = (await query("SELECT (NOW() AT TIME ZONE 'America/Mazatlan')::date::text AS hoy")).rows[0].hoy;
});
after(cerrarPool);

describe('GET /api/solicitudes con busqueda', () => {
  it('"#id" o el numero solo encuentran esa solicitud', async () => {
    assert.deepEqual(ids(await buscar(tokenHospital1, { q: '#' + idCadera })), [idCadera]);
    assert.deepEqual(ids(await buscar(tokenHospital1, { q: String(idProgramada) })), [idProgramada]);
  });

  it('el codigo de asistencia lleva a la solicitud, con o sin ceros y guion', async () => {
    const codigo = 'N-' + String(idNotificacion).padStart(4, '0');
    assert.deepEqual(ids(await buscar(tokenHospital1, { q: codigo })), [idCadera]);
    assert.deepEqual(ids(await buscar(tokenHospital1, { q: 'n' + idNotificacion })), [idCadera]);
  });

  it('un hospital solo busca en sus solicitudes aunque pida otro hospital', async () => {
    const codigo = 'N-' + idNotificacion;
    assert.equal((await buscar(tokenHospital2, { q: codigo })).body.total, 0);
    assert.equal((await buscar(tokenHospital2, { q: codigo, id_hospital: 1 })).body.total, 0);
    assert.deepEqual(ids(await buscar(tokenHospital2, { q: 'cadera' })), [idCaderaHospital2]);
  });

  it('el texto busca en descripcion y paciente sin distinguir mayusculas ni acentos', async () => {
    assert.deepEqual(ids(await buscar(tokenAdmin, { q: 'cadera' })), [idCadera, idCaderaHospital2].sort((a, b) => a - b));
    assert.deepEqual(ids(await buscar(tokenHospital1, { q: 'cadera' })), [idCadera]);
    assert.deepEqual(ids(await buscar(tokenHospital1, { q: 'nunez' })), [idCiudadana]);
    assert.deepEqual(ids(await buscar(tokenAdmin, { q: 'JOSÉ' })), [idCiudadana]);
  });

  it('quien solo ve las iniciales no encuentra al paciente por su nombre', async () => {
    const donante = await crearDonante(app, request, { id_tipo_sangre: 8 });
    await request(app).patch(`/api/solicitudes/${idCiudadana}/urgencia`).set(bearer(tokenHospital1)).send({ urgencia: 'urgente' });
    assert.equal((await buscar(donante.token, { q: 'nunez' })).body.total, 0);
  });

  it('filtra por tipo de sangre, prioridad, origen y fechas', async () => {
    assert.deepEqual(ids(await buscar(tokenHospital1, { id_hospital: 1, id_tipo_sangre: 3 })), [idProgramada]);
    assert.deepEqual(ids(await buscar(tokenHospital1, { id_hospital: 1, urgencia: 'critica' })), [idCadera]);
    assert.deepEqual(ids(await buscar(tokenHospital1, { id_hospital: 1, origen: 'ciudadana' })), [idCiudadana]);
    assert.deepEqual(ids(await buscar(tokenHospital1, { id_hospital: 1, origen: 'hospital' })), [idCadera, idProgramada]);
    assert.equal((await buscar(tokenAdmin, { desde: hoy, hasta: hoy })).body.total, 4);
    assert.equal((await buscar(tokenAdmin, { hasta: '2020-01-01' })).body.total, 0);
  });

  it('valida los filtros', async () => {
    assert.equal((await buscar(tokenAdmin, { urgencia: 'baja' })).status, 400);
    assert.equal((await buscar(tokenAdmin, { origen: 'otro' })).status, 400);
    assert.equal((await buscar(tokenAdmin, { desde: '2026-02-30' })).status, 400);
    assert.equal((await buscar(tokenAdmin, { desde: '2026-12-02', hasta: '2026-12-01' })).status, 400);
    assert.equal((await buscar(tokenAdmin, { id_tipo_sangre: 'x' })).status, 400);
    assert.equal((await buscar(tokenAdmin, { q: 'a'.repeat(101) })).status, 400);
  });
});

describe('GET /api/auth/usuarios con busqueda', () => {
  const usuarios = (filtros) => request(app).get('/api/auth/usuarios').query(filtros).set(bearer(tokenAdmin));

  it('busca por parte del correo sin distinguir mayusculas', async () => {
    const res = await usuarios({ correo: 'HOSPITAL1@' });
    assert.deepEqual(res.body.usuarios.map((u) => u.email), ['hospital1@demo.donadores.mx']);
  });

  it('filtra por cuenta activa y por hospital', async () => {
    const donante = await crearDonante(app, request);
    await request(app).patch(`/api/auth/usuarios/${donante.id_usuario}/activo`).set(bearer(tokenAdmin)).send({ activo: false });
    const inactivas = await usuarios({ activo: 'false' });
    assert.deepEqual(inactivas.body.usuarios.map((u) => u.id), [donante.id_usuario]);
    assert.ok((await usuarios({ activo: 'true' })).body.usuarios.every((u) => u.activo));
    assert.ok((await usuarios({ id_hospital: 2 })).body.usuarios.every((u) => u.id_hospital === 2));
  });

  it('valida los filtros', async () => {
    assert.equal((await usuarios({ activo: 'si' })).status, 400);
    assert.equal((await usuarios({ activo: 'toString' })).status, 400);
    assert.equal((await usuarios({ id_hospital: 'x' })).status, 400);
  });
});

describe('GET /api/auditoria/bitacora por solicitud', () => {
  it('devuelve solo las acciones de esa solicitud', async () => {
    const res = await request(app).get('/api/auditoria/bitacora').query({ id_solicitud: idCadera }).set(bearer(tokenAdmin));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.entradas.map((e) => e.accion).sort(), ['NOTIFICACIONES_ENVIADAS', 'SOLICITUD_CREADA']);
    assert.ok(res.body.entradas.every((e) => e.id_solicitud === idCadera));
  });

  it('valida el id', async () => {
    const res = await request(app).get('/api/auditoria/bitacora').query({ id_solicitud: 'abc' }).set(bearer(tokenAdmin));
    assert.equal(res.status, 400);
  });
});
