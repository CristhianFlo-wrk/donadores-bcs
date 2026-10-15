import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query, transaccion } from '../src/config/database.js';
import { registrarEntrada, registrarLog, verificarHistorial, verificarLogs } from '../src/modules/auditoria/auditoria.service.js';
import { prepararBaseDatos, crearDonante, loginDemo } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let donante;
let hashDonante;
let tokenAdmin;
let tokenHospital;

const donar = (idHospital = 1, region = 'sur') =>
  transaccion((client) => registrarEntrada(client, { idDonanteHash: hashDonante, grupoSanguineo: 'O-', idHospital, region }));

before(async () => {
  await prepararBaseDatos();
  donante = await crearDonante(app, request);
  const { rows } = await query('SELECT curp_hash FROM donantes WHERE id = $1', [donante.id_donante]);
  hashDonante = rows[0].curp_hash;
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');
  tokenHospital = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
});
after(cerrarPool);

describe('cadena de historial_donaciones', () => {
  it('encadena entradas y verifica despues de leerlas de PostgreSQL', async () => {
    const primera = await donar(1, 'sur');
    const segunda = await donar(4, 'centro');
    assert.equal(primera.hash_anterior, '0'.repeat(64));
    assert.equal(segunda.hash_anterior, primera.hash_actual);

    const verificacion = await verificarHistorial(hashDonante);
    assert.equal(verificacion.integra, true);
    assert.equal(verificacion.total, 2);
  });

  it('dos donaciones simultaneas del mismo donante no bifurcan la cadena', async () => {
    await Promise.all([donar(), donar(), donar()]);
    const { rows } = await query(
      'SELECT COUNT(*) AS total, COUNT(DISTINCT hash_anterior) AS distintos FROM historial_donaciones WHERE id_donante_hash = $1',
      [hashDonante]
    );
    assert.equal(rows[0].total, rows[0].distintos);
    assert.equal((await verificarHistorial(hashDonante)).integra, true);
  });

  it('detecta alteracion de datos', async () => {
    const { rows } = await query('SELECT id, id_hospital FROM historial_donaciones WHERE id_donante_hash = $1 ORDER BY id LIMIT 1', [hashDonante]);
    await query('UPDATE historial_donaciones SET id_hospital = 2 WHERE id = $1', [rows[0].id]);

    const verificacion = await verificarHistorial(hashDonante);
    assert.equal(verificacion.integra, false);
    assert.equal(verificacion.id_roto, rows[0].id);

    await query('UPDATE historial_donaciones SET id_hospital = $1 WHERE id = $2', [rows[0].id_hospital, rows[0].id]);
    assert.equal((await verificarHistorial(hashDonante)).integra, true);
  });

  it('detecta borrado de una entrada intermedia', async () => {
    const { rows } = await query('SELECT * FROM historial_donaciones WHERE id_donante_hash = $1 ORDER BY id LIMIT 1 OFFSET 1', [hashDonante]);
    await query('DELETE FROM historial_donaciones WHERE id = $1', [rows[0].id]);
    assert.equal((await verificarHistorial(hashDonante)).integra, false);

    const f = rows[0];
    await query(`
      INSERT INTO historial_donaciones (id, id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, region, hash_anterior, hash_actual, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [f.id, f.id_donante_hash, f.fecha_donacion, f.grupo_sanguineo, f.id_hospital, f.region, f.hash_anterior, f.hash_actual, f.created_at]);
    assert.equal((await verificarHistorial(hashDonante)).integra, true);
  });
});

describe('cadena global de auditoria_logs', () => {
  it('las acciones de los modulos quedan registradas', async () => {
    await request(app).patch('/api/donantes/disponibilidad').set(bearer(donante.token)).send({ disponible: false });
    await request(app).post('/api/auth/login').send({ email: 'nadie@test.com', password: 'incorrecta' });
    await request(app).post('/api/solicitudes').set(bearer(tokenHospital)).send({ id_tipo_sangre: 1, urgencia: 'urgente' });

    const { rows } = await query('SELECT accion FROM auditoria_logs ORDER BY id');
    const acciones = rows.map((r) => r.accion);
    for (const accion of ['REGISTRO_DONANTE', 'LOGIN_EXITOSO', 'DISPONIBILIDAD_CAMBIADA', 'LOGIN_FALLIDO', 'SOLICITUD_CREADA']) {
      assert.ok(acciones.includes(accion), accion);
    }
  });

  it('el log no guarda datos personales', async () => {
    const { rows } = await query("SELECT detalles::text AS texto FROM auditoria_logs WHERE accion = 'REGISTRO_DONANTE'");
    assert.doesNotMatch(rows[0].texto, /Donante Prueba|DONA950520/);
  });

  it('verifica con detalles JSONB aunque PostgreSQL reordene las llaves', async () => {
    await registrarLog(null, { idUsuario: null, accion: 'PRUEBA', detalles: { zeta: 1, a: { y: [1, 2], b: 'x' } }, ipOrigen: '::1' });
    assert.equal((await verificarLogs()).integra, true);
  });

  it('logs concurrentes no bifurcan la cadena', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => registrarLog(null, { accion: 'CONCURRENTE', detalles: { i } })));
    const verificacion = await verificarLogs();
    assert.equal(verificacion.integra, true);
  });

  it('detecta alteracion de un log', async () => {
    await query("UPDATE auditoria_logs SET accion = 'OTRA' WHERE id = 1");
    const verificacion = await verificarLogs();
    assert.equal(verificacion.integra, false);
    assert.equal(verificacion.id_roto, 1);
    await query("UPDATE auditoria_logs SET accion = 'REGISTRO_DONANTE' WHERE id = 1");
  });
});

describe('endpoints /api/auditoria', () => {
  it('el donante ve su propio historial verificado sin conocer su hash', async () => {
    const res = await request(app).get('/api/auditoria/mi-historial').set(bearer(donante.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.verificacion.integra, true);
    assert.equal(res.body.total, 5);
    assert.ok(res.body.entradas[0].hospital_nombre);
  });

  it('admin verifica y consulta historial por hash y estado global', async () => {
    const verificar = await request(app).get('/api/auditoria/verificar/' + hashDonante).set(bearer(tokenAdmin));
    assert.equal(verificar.status, 200);
    assert.equal(verificar.body.verificacion.integra, true);

    const historial = await request(app).get('/api/auditoria/historial/' + hashDonante).set(bearer(tokenAdmin));
    assert.equal(historial.body.total, 5);

    const estado = await request(app).get('/api/auditoria/estado').set(bearer(tokenAdmin));
    assert.equal(estado.body.estado.total_donaciones, 5);
    assert.equal(estado.body.estado.donantes_con_historial, 1);
    assert.ok(estado.body.estado.total_logs > 0);
  });

  it('hospitales y donantes no acceden a los endpoints de admin', async () => {
    for (const token of [tokenHospital, donante.token]) {
      assert.equal((await request(app).get('/api/auditoria/estado').set(bearer(token))).status, 403);
      assert.equal((await request(app).get('/api/auditoria/verificar/' + hashDonante).set(bearer(token))).status, 403);
    }
    assert.equal((await request(app).get('/api/auditoria/mi-historial').set(bearer(tokenHospital))).status, 403);
  });

  it('400 con hash mal formado y sin endpoint de registro', async () => {
    assert.equal((await request(app).get('/api/auditoria/verificar/abc').set(bearer(tokenAdmin))).status, 400);
    assert.equal((await request(app).post('/api/auditoria/registrar').set(bearer(tokenAdmin)).send({})).status, 404);
  });
});
