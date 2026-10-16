import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { prepararBaseDatos, crearDonante, loginDemo } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let tokenAdmin;
let tokenHospital1;
let donante;

const crear = (token, datos) => request(app).post('/api/auth/usuarios').set(bearer(token)).send(datos);

before(async () => {
  await prepararBaseDatos();
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');
  tokenHospital1 = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  donante = await crearDonante(app, request);
});
after(cerrarPool);

describe('POST /api/auth/usuarios', () => {
  it('admin crea un usuario hospital ligado a su hospital y puede iniciar sesion', async () => {
    const res = await crear(tokenAdmin, { email: 'Coordinador@IMSS.mx', password: 'Segura12345', rol: 'hospital', id_hospital: 4 });
    assert.equal(res.status, 201);
    assert.equal(res.body.usuario.email, 'coordinador@imss.mx');
    assert.equal(res.body.usuario.id_hospital, 4);
    assert.equal(res.body.usuario.password_hash, undefined);

    const login = await request(app).post('/api/auth/login').send({ email: 'coordinador@imss.mx', password: 'Segura12345' });
    assert.equal(login.status, 200);
    assert.equal(login.body.usuario.id_hospital, 4);

    const { rows } = await query("SELECT detalles FROM auditoria_logs WHERE accion = 'USUARIO_CREADO'");
    assert.equal(rows[0].detalles.id_hospital, 4);
  });

  it('admin crea otro admin sin id_hospital', async () => {
    const res = await crear(tokenAdmin, { email: 'admin2@example.com', password: 'Segura12345', rol: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.usuario.id_hospital, null);
  });

  it('valida rol, hospital, email duplicado y password', async () => {
    assert.equal((await crear(tokenAdmin, { email: 'x@example.com', password: 'Segura12345', rol: 'donante' })).status, 400);
    assert.equal((await crear(tokenAdmin, { email: 'x@example.com', password: 'Segura12345', rol: 'hospital' })).status, 400);
    assert.equal((await crear(tokenAdmin, { email: 'x@example.com', password: 'Segura12345', rol: 'hospital', id_hospital: 999 })).status, 400);
    assert.equal((await crear(tokenAdmin, { email: 'x@example.com', password: 'Segura12345', rol: 'admin', id_hospital: 1 })).status, 400);
    assert.equal((await crear(tokenAdmin, { email: 'x@example.com', password: 'corta', rol: 'admin' })).status, 400);
    assert.equal((await crear(tokenAdmin, { email: 'admin2@example.com', password: 'Segura12345', rol: 'admin' })).status, 400);
  });

  it('solo admin', async () => {
    assert.equal((await crear(tokenHospital1, { email: 'y@example.com', password: 'Segura12345', rol: 'admin' })).status, 403);
    assert.equal((await crear(donante.token, { email: 'y@example.com', password: 'Segura12345', rol: 'admin' })).status, 403);
  });
});

describe('GET /api/auth/usuarios', () => {
  it('lista y filtra por rol sin exponer password_hash', async () => {
    const res = await request(app).get('/api/auth/usuarios?rol=hospital').set(bearer(tokenAdmin));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 9);
    assert.ok(res.body.usuarios.every((u) => u.rol === 'hospital' && u.password_hash === undefined));
    assert.equal((await request(app).get('/api/auth/usuarios?rol=otro').set(bearer(tokenAdmin))).status, 400);
  });
});

describe('PATCH /api/auth/usuarios/:id/activo', () => {
  it('desactivar corta el acceso de inmediato aunque el token siga vigente', async () => {
    assert.equal((await request(app).get('/api/donantes/perfil').set(bearer(donante.token))).status, 200);

    const res = await request(app).patch(`/api/auth/usuarios/${donante.id_usuario}/activo`).set(bearer(tokenAdmin)).send({ activo: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.activo, false);

    assert.equal((await request(app).get('/api/donantes/perfil').set(bearer(donante.token))).status, 401);

    await request(app).patch(`/api/auth/usuarios/${donante.id_usuario}/activo`).set(bearer(tokenAdmin)).send({ activo: true });
    assert.equal((await request(app).get('/api/donantes/perfil').set(bearer(donante.token))).status, 200);
  });

  it('el rol se toma de la base y no del token', async () => {
    const { rows } = await query("SELECT id FROM usuarios WHERE email = 'hospital1@demo.donadores.mx'");
    await query('UPDATE usuarios SET id_hospital = 2 WHERE id = $1', [rows[0].id]);
    const perfil = await request(app).get('/api/auth/perfil').set(bearer(tokenHospital1));
    assert.equal(perfil.body.usuario.id_hospital, 2);
    await query('UPDATE usuarios SET id_hospital = 1 WHERE id = $1', [rows[0].id]);
  });

  it('valida el body, el usuario y no permite desactivarse a si mismo', async () => {
    assert.equal((await request(app).patch(`/api/auth/usuarios/${donante.id_usuario}/activo`).set(bearer(tokenAdmin)).send({ activo: 'no' })).status, 400);
    assert.equal((await request(app).patch('/api/auth/usuarios/9999/activo').set(bearer(tokenAdmin)).send({ activo: false })).status, 404);
    assert.equal((await request(app).patch('/api/auth/usuarios/1/activo').set(bearer(tokenAdmin)).send({ activo: false })).status, 400);
    assert.equal((await request(app).patch('/api/auth/usuarios/1/activo').set(bearer(tokenHospital1)).send({ activo: false })).status, 403);
  });
});
