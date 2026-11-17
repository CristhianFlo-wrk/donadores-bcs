import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { prepararBaseDatos, loginDemo, contarFilas } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let tokenAdmin;
let tokenHospital;

const HOSPITAL = {
  nombre: 'Hospital Comunitario Guerrero Negro',
  institucion: 'IMSS-BIENESTAR',
  id_municipio: 1,
  direccion: 'Av. Baja California S/N, Guerrero Negro, BCS',
  telefono: '615 157 0000',
  clues: 'bsimb000123',
  latitud: 27.9677,
  longitud: -114.0563
};

const COLONIA = { id_municipio: 4, nombre: 'El Zacatal', codigo_postal: '23088' };

const crearHospital = (token, datos) => request(app).post('/api/hospitales').set(bearer(token)).send(datos);
const crearColonia = (token, datos) => request(app).post('/api/ubicaciones/colonias').set(bearer(token)).send(datos);

async function ultimoLog(accion) {
  const { rows } = await query('SELECT id_usuario, detalles FROM auditoria_logs WHERE accion = $1 ORDER BY id DESC LIMIT 1', [accion]);
  return rows[0];
}

before(async () => {
  await prepararBaseDatos();
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');
  tokenHospital = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
});
after(cerrarPool);

describe('POST /api/hospitales', () => {
  it('solo el admin crea hospitales', async () => {
    assert.equal((await request(app).post('/api/hospitales').send(HOSPITAL)).status, 401);
    assert.equal((await crearHospital(tokenHospital, HOSPITAL)).status, 403);
  });

  it('crea el hospital con la region de su municipio, datos normalizados y log', async () => {
    const res = await crearHospital(tokenAdmin, { ...HOSPITAL, region: 'sur' });
    assert.equal(res.status, 201);
    const { hospital } = res.body;
    assert.equal(hospital.region, 'norte');
    assert.equal(hospital.municipio, 'Mulege');
    assert.equal(hospital.clues, 'BSIMB000123');
    assert.equal(hospital.telefono, '6151570000');

    const log = await ultimoLog('HOSPITAL_CREADO');
    assert.equal(log.id_usuario, 1);
    assert.deepEqual(log.detalles, { id_hospital: hospital.id, nombre: HOSPITAL.nombre, municipio: 'Mulege', region: 'norte' });

    // Queda disponible para crear cuentas y en el listado
    const cuenta = await request(app).post('/api/auth/usuarios').set(bearer(tokenAdmin))
      .send({ email: 'gn@hospital.mx', password: 'Segura12345', rol: 'hospital', id_hospital: hospital.id });
    assert.equal(cuenta.status, 201);
    const lista = await request(app).get('/api/hospitales?region=norte').set(bearer(tokenAdmin));
    assert.ok(lista.body.hospitales.some((h) => h.id === hospital.id));
  });

  it('rechaza nombre repetido en el municipio y CLUES repetida', async () => {
    const nombre = await crearHospital(tokenAdmin, { ...HOSPITAL, nombre: HOSPITAL.nombre.toUpperCase(), clues: '' });
    assert.equal(nombre.status, 400);
    assert.match(nombre.body.error, /Ya existe/);
    const clues = await crearHospital(tokenAdmin, { ...HOSPITAL, nombre: 'Otro hospital de Mulege' });
    assert.equal(clues.status, 400);
    assert.match(clues.body.error, /CLUES ya está registrada/);
  });

  it('valida cada campo sin crear nada', async () => {
    const antes = await contarFilas('hospitales');
    const casos = [
      [{ nombre: '  ' }, /nombre/],
      [{ institucion: 'IMSS ' }, /institucion/],
      [{ institucion: 'toString' }, /institucion/],
      [{ id_municipio: 99 }, /Municipio no encontrado/],
      [{ direccion: 'Centro' }, /direccion/],
      [{ telefono: '61212' }, /telefono/],
      [{ clues: 'BCIMS000013' }, /clues/],
      [{ latitud: 24.1 , longitud: '' }, /latitud y longitud/],
      [{ latitud: 24.1, longitud: 110.3 }, /fuera de Baja California Sur/]
    ];
    for (const [cambio, mensaje] of casos) {
      const res = await crearHospital(tokenAdmin, { ...HOSPITAL, nombre: 'Hospital de prueba', clues: '', ...cambio });
      assert.equal(res.status, 400, JSON.stringify(cambio));
      assert.match(res.body.error, mensaje);
    }
    assert.equal(await contarFilas('hospitales'), antes);
  });

  it('los opcionales pueden faltar', async () => {
    const { telefono, clues, latitud, longitud, ...minimo } = HOSPITAL;
    const res = await crearHospital(tokenAdmin, { ...minimo, nombre: 'Clinica Santa Rosalia', institucion: 'privado' });
    assert.equal(res.status, 201);
    assert.equal(res.body.hospital.clues, null);
    assert.equal(res.body.hospital.latitud, null);
  });
});

describe('PATCH /api/hospitales/:id', () => {
  const editar = (token, id, datos) => request(app).patch('/api/hospitales/' + id).set(bearer(token)).send(datos);

  it('solo el admin edita', async () => {
    assert.equal((await editar(tokenHospital, 1, { telefono: '6121234567' })).status, 403);
  });

  it('corrige campos, recalcula la region con el municipio y registra solo lo que cambio', async () => {
    const res = await editar(tokenAdmin, 1, { telefono: '612 123 4567', id_municipio: 5, nombre: 'IMSS HGZ No. 1 La Paz' });
    assert.equal(res.status, 200);
    assert.equal(res.body.hospital.telefono, '6121234567');
    assert.equal(res.body.hospital.municipio, 'Los Cabos');
    assert.equal(res.body.hospital.region, 'sur');
    const log = await ultimoLog('HOSPITAL_EDITADO');
    assert.deepEqual(log.detalles, { id_hospital: 1, campos: ['id_municipio', 'telefono'] });

    // Mover a Comondu cambia la region
    const centro = await editar(tokenAdmin, 1, { id_municipio: 3 });
    assert.equal(centro.body.hospital.region, 'centro');
    // Sin cambios reales no hay log nuevo
    const antes = await contarFilas('auditoria_logs');
    assert.equal((await editar(tokenAdmin, 1, { id_municipio: 3 })).status, 200);
    assert.equal(await contarFilas('auditoria_logs'), antes);
  });

  it('valida lo enviado y rechaza nombre ajeno, CLUES ajena y cuerpo vacio', async () => {
    assert.equal((await editar(tokenAdmin, 2, {})).status, 400);
    assert.equal((await editar(tokenAdmin, 2, { telefono: '12' })).status, 400);
    assert.equal((await editar(tokenAdmin, 2, { latitud: 24.1 })).status, 400);
    assert.equal((await editar(tokenAdmin, 999, { telefono: '6121234567' })).status, 404);
    const nombre = await editar(tokenAdmin, 2, { nombre: 'hospital general salvatierra' });
    assert.match(nombre.body.error, /Ya existe/);
    const clues = await editar(tokenAdmin, 2, { clues: 'BSIMB000123' });
    assert.match(clues.body.error, /CLUES ya está registrada/);
  });
});

describe('PATCH /api/hospitales/:id/activo', () => {
  const cambiar = (token, id, activo) => request(app).patch('/api/hospitales/' + id + '/activo').set(bearer(token)).send({ activo });

  it('no desactiva un hospital con solicitudes activas', async () => {
    const solicitud = await request(app).post('/api/solicitudes').set(bearer(tokenHospital)).send({ id_tipo_sangre: 1, urgencia: 'normal' });
    assert.equal(solicitud.status, 201);
    const res = await cambiar(tokenAdmin, 1, false);
    assert.equal(res.status, 409);
    assert.match(res.body.error, /solicitud activa/);
  });

  it('desactiva el hospital y sus cuentas; deja de listarse salvo para el admin que lo pide', async () => {
    const { rows } = await query("SELECT id FROM hospitales WHERE nombre = $1", [HOSPITAL.nombre]);
    const id = rows[0].id;
    assert.equal((await cambiar(tokenAdmin, id, 'false')).status, 400);

    const res = await cambiar(tokenAdmin, id, false);
    assert.equal(res.status, 200);
    assert.equal(res.body.hospital.activo, false);
    assert.equal(res.body.cuentas_desactivadas, 1);
    assert.deepEqual((await ultimoLog('HOSPITAL_DESACTIVADO')).detalles, { id_hospital: id, cuentas_desactivadas: 1 });

    const login = await request(app).post('/api/auth/login').send({ email: 'gn@hospital.mx', password: 'Segura12345' });
    assert.notEqual(login.status, 200);
    const publico = await request(app).get('/api/hospitales?incluir_inactivos=true').set(bearer(tokenHospital));
    assert.ok(!publico.body.hospitales.some((h) => h.id === id));
    const admin = await request(app).get('/api/hospitales?incluir_inactivos=true').set(bearer(tokenAdmin));
    assert.ok(admin.body.hospitales.some((h) => h.id === id && h.activo === false));
    const cuenta = await request(app).post('/api/auth/usuarios').set(bearer(tokenAdmin))
      .send({ email: 'otro@hospital.mx', password: 'Segura12345', rol: 'hospital', id_hospital: id });
    assert.equal(cuenta.status, 400);

    // Se edita aun inactivo y se reactiva; las cuentas siguen desactivadas
    assert.equal((await request(app).patch('/api/hospitales/' + id).set(bearer(tokenAdmin)).send({ telefono: '6150000000' })).status, 200);
    const activo = await cambiar(tokenAdmin, id, true);
    assert.equal(activo.body.hospital.activo, true);
    assert.equal((await ultimoLog('HOSPITAL_ACTIVADO')).detalles.id_hospital, id);
    const { rows: cuentas } = await query('SELECT activo FROM usuarios WHERE email = $1', ['gn@hospital.mx']);
    assert.equal(cuentas[0].activo, false);
  });
});

describe('POST /api/ubicaciones/colonias', () => {
  it('solo el admin crea colonias', async () => {
    assert.equal((await request(app).post('/api/ubicaciones/colonias').send(COLONIA)).status, 401);
    assert.equal((await crearColonia(tokenHospital, COLONIA)).status, 403);
  });

  it('crea la colonia, aparece en su municipio y deja log', async () => {
    const res = await crearColonia(tokenAdmin, { ...COLONIA, nombre: '  El   Zacatal ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.colonia.nombre, 'El Zacatal');

    const lista = await request(app).get('/api/ubicaciones/colonias/4');
    assert.ok(lista.body.colonias.some((c) => c.id === res.body.colonia.id));
    const log = await ultimoLog('COLONIA_CREADA');
    assert.deepEqual(log.detalles, { id_colonia: res.body.colonia.id, nombre: 'El Zacatal', municipio: 'La Paz', codigo_postal: '23088' });

    // Un donante ya puede registrarse en ella sin escribir colonia_personalizada
    const registro = await request(app).post('/api/auth/registro').send({
      email: 'zacatal@test.com', password: 'MiPassword123', nombre_completo: 'Vecina Zacatal', curp: 'ZACA950520MBSRPNA1',
      fecha_nacimiento: '1995-05-20', id_tipo_sangre: 2, id_colonia: res.body.colonia.id, acepta_privacidad: true
    });
    assert.equal(registro.status, 201);
  });

  it('rechaza repetidas sin importar mayusculas, la reservada "Otra" y datos invalidos', async () => {
    const casos = [
      [{ nombre: 'el zacatal' }, /ya existe en La Paz/],
      [{ nombre: 'OTRA' }, /reservado/],
      [{ nombre: 'x' }, /nombre/],
      [{ codigo_postal: '2308' }, /codigo_postal/],
      [{ codigo_postal: '22000' }, /codigo_postal/],
      [{ id_municipio: 'abc' }, /id_municipio/],
      [{ id_municipio: 99 }, /Municipio no encontrado/]
    ];
    for (const [cambio, mensaje] of casos) {
      const res = await crearColonia(tokenAdmin, { ...COLONIA, ...cambio });
      assert.equal(res.status, 400, JSON.stringify(cambio));
      assert.match(res.body.error, mensaje);
    }
  });

  it('el mismo nombre si se acepta en otro municipio', async () => {
    const res = await crearColonia(tokenAdmin, { ...COLONIA, id_municipio: 5, codigo_postal: '23400' });
    assert.equal(res.status, 201);
  });
});

describe('PATCH /api/ubicaciones/colonias/:id', () => {
  const editar = (token, id, datos) => request(app).patch('/api/ubicaciones/colonias/' + id).set(bearer(token)).send(datos);
  const cambiar = (id, activo) => request(app).patch('/api/ubicaciones/colonias/' + id + '/activo').set(bearer(tokenAdmin)).send({ activo });
  const idDe = async (nombre, idMunicipio) => (await query('SELECT id FROM colonias WHERE nombre = $1 AND id_municipio = $2', [nombre, idMunicipio])).rows[0].id;

  it('solo el admin edita', async () => {
    assert.equal((await editar(tokenHospital, await idDe('El Zacatal', 4), { codigo_postal: '23089' })).status, 403);
  });

  it('corrige nombre y codigo postal con log de los campos', async () => {
    const id = await idDe('El Zacatal', 4);
    const res = await editar(tokenAdmin, id, { nombre: 'Zacatal', codigo_postal: '23089' });
    assert.equal(res.status, 200);
    assert.equal(res.body.colonia.nombre, 'Zacatal');
    assert.deepEqual((await ultimoLog('COLONIA_EDITADA')).detalles, { id_colonia: id, campos: ['nombre', 'codigo_postal'] });
  });

  it('no cambia de municipio, no repite nombre y no toca "Otra"', async () => {
    const id = await idDe('Zacatal', 4);
    assert.match((await editar(tokenAdmin, id, { id_municipio: 5 })).body.error, /no cambia de municipio/);
    assert.match((await editar(tokenAdmin, id, { nombre: 'CENTRO' })).body.error, /ya existe en La Paz/);
    assert.match((await editar(tokenAdmin, id, { nombre: 'otra' })).body.error, /reservado/);
    const otra = await idDe('Otra', 4);
    assert.match((await editar(tokenAdmin, otra, { codigo_postal: '23000' })).body.error, /no se puede modificar/);
    assert.equal((await cambiar(otra, false)).status, 400);
    assert.equal((await editar(tokenAdmin, 99999, { codigo_postal: '23000' })).status, 404);
  });

  it('desactivada sale del registro pero el donante que vive ahi la conserva', async () => {
    const id = await idDe('Zacatal', 4);
    const res = await cambiar(id, false);
    assert.equal(res.status, 200);
    assert.equal(res.body.colonia.activo, false);
    assert.equal((await ultimoLog('COLONIA_DESACTIVADA')).detalles.id_colonia, id);

    const publica = await request(app).get('/api/ubicaciones/colonias/4');
    assert.ok(!publica.body.colonias.some((c) => c.id === id));
    const todas = await request(app).get('/api/ubicaciones/colonias/4?incluir_inactivas=true');
    assert.ok(todas.body.colonias.some((c) => c.id === id && c.activo === false));

    const registro = await request(app).post('/api/auth/registro').send({
      email: 'zacatal2@test.com', password: 'MiPassword123', nombre_completo: 'Otra Vecina', curp: 'ZACB950520MBSRPNA1',
      fecha_nacimiento: '1995-05-20', id_tipo_sangre: 2, id_colonia: id, acepta_privacidad: true
    });
    assert.equal(registro.status, 400);
    const { rows } = await query("SELECT d.id_colonia FROM donantes d JOIN usuarios u ON u.id = d.id_usuario WHERE u.email = 'zacatal@test.com'");
    assert.equal(rows[0].id_colonia, id);

    assert.equal((await cambiar(id, true)).body.colonia.activo, true);
  });
});
