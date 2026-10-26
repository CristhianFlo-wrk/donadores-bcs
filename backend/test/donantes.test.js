import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { buscarCompatibles } from '../src/modules/donantes/donantes.service.js';
import { prepararBaseDatos, crearDonante, loginDemo, idColonia } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let donante;
let tokenHospital;
let tokenAdmin;

before(async () => {
  await prepararBaseDatos();
  donante = await crearDonante(app, request, { telefono: '6121112233', peso_kg: 72.5 });
  tokenHospital = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');
});
after(cerrarPool);

describe('usuarios demo de seeds', () => {
  it('admin y hospitales pueden iniciar sesion', () => {
    assert.ok(tokenHospital);
    assert.ok(tokenAdmin);
  });
});

describe('GET /api/donantes/perfil', () => {
  it('devuelve datos descifrados y tipos correctos', async () => {
    const res = await request(app).get('/api/donantes/perfil').set(bearer(donante.token));
    assert.equal(res.status, 200);
    const { perfil } = res.body;
    assert.equal(perfil.nombre_completo, 'Donante Prueba 0');
    assert.equal(perfil.telefono, '6121112233');
    assert.equal(perfil.fecha_nacimiento, '1995-05-20');
    assert.equal(perfil.peso_kg, 72.5);
    assert.equal(perfil.disponible, true);
    assert.equal(perfil.tipo_sangre, 'O-');
    assert.equal(perfil.ubicacion.region, 'sur');
    assert.equal(perfil.ubicacion.municipio, 'La Paz');
    assert.equal(perfil.curp_hash, undefined);
  });

  it('401 sin token y 403 para rol hospital', async () => {
    assert.equal((await request(app).get('/api/donantes/perfil')).status, 401);
    assert.equal((await request(app).get('/api/donantes/perfil').set(bearer(tokenHospital))).status, 403);
  });
});

describe('PUT /api/donantes/perfil', () => {
  it('actualiza nombre, telefono y peso', async () => {
    const res = await request(app).put('/api/donantes/perfil').set(bearer(donante.token))
      .send({ nombre_completo: 'Nombre Nuevo', telefono: '6129998877', peso_kg: 80 });
    assert.equal(res.status, 200);
    assert.equal(res.body.perfil.nombre_completo, 'Nombre Nuevo');
    assert.equal(res.body.perfil.telefono, '6129998877');
    assert.equal(res.body.perfil.peso_kg, 80);
  });

  it('cambiar de colonia recalcula la region', async () => {
    const idOtraMulege = await idColonia('Otra', 'Mulege');
    const res = await request(app).put('/api/donantes/perfil').set(bearer(donante.token))
      .send({ id_colonia: idOtraMulege, colonia_personalizada: 'San Bruno' });
    assert.equal(res.status, 200);
    assert.equal(res.body.perfil.ubicacion.region, 'norte');
    assert.equal(res.body.perfil.ubicacion.colonia, 'San Bruno');

    const regreso = await request(app).put('/api/donantes/perfil').set(bearer(donante.token))
      .send({ id_colonia: await idColonia('Centro', 'La Paz') });
    assert.equal(regreso.body.perfil.ubicacion.region, 'sur');
    assert.equal(regreso.body.perfil.ubicacion.colonia, 'Centro');
  });

  it('valida los cambios', async () => {
    const casos = [
      {},
      { peso_kg: 40 },
      { peso_kg: null },
      { nombre_completo: '  ' },
      { id_tipo_sangre: 99 },
      { latitud: 200 },
      { colonia_personalizada: 'Sin id_colonia' },
      { id_colonia: await idColonia('Otra', 'Loreto') }
    ];
    for (const cambios of casos) {
      const res = await request(app).put('/api/donantes/perfil').set(bearer(donante.token)).send(cambios);
      assert.equal(res.status, 400, JSON.stringify(cambios));
      assert.equal(res.body.ok, false);
    }
  });
});

describe('PATCH /api/donantes/disponibilidad', () => {
  it('cambia la disponibilidad y exige boolean', async () => {
    const off = await request(app).patch('/api/donantes/disponibilidad').set(bearer(donante.token)).send({ disponible: false });
    assert.deepEqual(off.body, { ok: true, disponible: false });

    const malo = await request(app).patch('/api/donantes/disponibilidad').set(bearer(donante.token)).send({ disponible: 'si' });
    assert.equal(malo.status, 400);

    const on = await request(app).patch('/api/donantes/disponibilidad').set(bearer(donante.token)).send({ disponible: true });
    assert.equal(on.body.disponible, true);
  });
});

describe('buscarCompatibles', () => {
  let abPositivo;
  let noDisponible;
  let donoReciente;

  before(async () => {
    // tipos: 1 O-, 4 A+, 8 AB+
    abPositivo = await crearDonante(app, request, { id_tipo_sangre: 8 });
    noDisponible = await crearDonante(app, request, { id_tipo_sangre: 4 });
    donoReciente = await crearDonante(app, request, { id_tipo_sangre: 4, id_colonia: await idColonia('Loreto Centro', 'Loreto') });
    await query('UPDATE donantes SET disponible = FALSE WHERE id = $1', [noDisponible.id_donante]);
    await query("UPDATE donantes SET ultima_donacion = NOW() - INTERVAL '10 days' WHERE id = $1", [donoReciente.id_donante]);
  });

  it('ya no existe un endpoint para listar donantes fuera de una solicitud', async () => {
    assert.equal((await request(app).get('/api/donantes/compatibles/4').set(bearer(tokenHospital))).status, 404);
  });

  it('para A+ devuelve O- y A+ aptos, sin AB+, sin no disponibles ni donacion reciente', async () => {
    const compatibles = await buscarCompatibles(4);
    const ids = compatibles.map((d) => d.id_donante);
    assert.ok(ids.includes(donante.id_donante));
    assert.ok(!ids.includes(abPositivo.id_donante));
    assert.ok(!ids.includes(noDisponible.id_donante));
    assert.ok(!ids.includes(donoReciente.id_donante));
    assert.equal(compatibles[0].tipo_sangre, 'O-');
  });

  it('no devuelve datos identificables', async () => {
    const [fila] = await buscarCompatibles(1);
    for (const campo of ['curp_hash', 'nombre_cifrado', 'nombre_parcial', 'telefono_cifrado', 'latitud', 'longitud']) {
      assert.equal(fila[campo], undefined, campo);
    }
  });

  it('filtros: solo_aptos=false, solo_disponibles=false y region', async () => {
    const ids = (await buscarCompatibles(4, { soloAptos: false, soloDisponibles: false })).map((d) => d.id_donante);
    assert.ok(ids.includes(noDisponible.id_donante));
    assert.ok(ids.includes(donoReciente.id_donante));

    const centro = await buscarCompatibles(4, { soloAptos: false, region: 'centro' });
    assert.deepEqual(centro.map((d) => d.id_donante), [donoReciente.id_donante]);
  });

  it('respeta el limite y rechaza un tipo inexistente', async () => {
    assert.equal((await buscarCompatibles(8, { limite: 1 })).length, 1);
    await assert.rejects(buscarCompatibles(99), { status: 404 });
  });
});

describe('GET /api/donantes/stats', () => {
  it('sin donaciones puede donar', async () => {
    const res = await request(app).get('/api/donantes/stats').set(bearer(donante.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.total_donaciones, 0);
    assert.equal(res.body.stats.puede_donar, true);
  });

  it('cuenta donaciones por region y aplica los 90 dias', async () => {
    const { rows } = await query('SELECT curp_hash FROM donantes WHERE id = $1', [donante.id_donante]);
    const hash = rows[0].curp_hash;
    await query(`
      INSERT INTO historial_donaciones (id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, region, hash_anterior, hash_actual)
      VALUES ($1, NOW() - INTERVAL '200 days', 'O-', 4, 'centro', $2, $3),
             ($1, NOW() - INTERVAL '30 days', 'O-', 1, 'sur', $3, $4)
    `, [hash, '0'.repeat(64), 'a'.repeat(64), 'b'.repeat(64)]);
    await query("UPDATE donantes SET ultima_donacion = NOW() - INTERVAL '30 days' WHERE id = $1", [donante.id_donante]);

    const res = await request(app).get('/api/donantes/stats').set(bearer(donante.token));
    const { stats } = res.body;
    assert.equal(stats.total_donaciones, 2);
    assert.deepEqual(stats.donaciones_por_region, [{ region: 'centro', total: 1 }, { region: 'sur', total: 1 }]);
    assert.equal(stats.dias_desde_ultima, 30);
    assert.equal(stats.puede_donar, false);
    assert.equal(stats.dias_para_poder_donar, 60);
  });
});

describe('PUT /api/donantes/fcm-token', () => {
  it('guarda y borra el token del dispositivo', async () => {
    const res = await request(app).put('/api/donantes/fcm-token').set(bearer(donante.token)).send({ fcm_token: 'token-dispositivo-123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.push_activo, true);
    const { rows } = await query('SELECT fcm_token FROM donantes WHERE id = $1', [donante.id_donante]);
    assert.equal(rows[0].fcm_token, 'token-dispositivo-123');

    const borrar = await request(app).put('/api/donantes/fcm-token').set(bearer(donante.token)).send({ fcm_token: null });
    assert.equal(borrar.body.push_activo, false);
  });

  it('valida el body y solo lo usan donantes', async () => {
    assert.equal((await request(app).put('/api/donantes/fcm-token').set(bearer(donante.token)).send({})).status, 400);
    assert.equal((await request(app).put('/api/donantes/fcm-token').set(bearer(donante.token)).send({ fcm_token: '  ' })).status, 400);
    assert.equal((await request(app).put('/api/donantes/fcm-token').set(bearer(donante.token)).send({ fcm_token: 123 })).status, 400);
    assert.equal((await request(app).put('/api/donantes/fcm-token').set(bearer(tokenHospital)).send({ fcm_token: 'x' })).status, 403);
  });
});

describe('datos con formato invalido responden 400 y no 500', () => {
  it('ids no numericos al actualizar perfil', async () => {
    assert.equal((await request(app).put('/api/donantes/perfil').set(bearer(donante.token)).send({ id_tipo_sangre: 'abc' })).status, 400);
    assert.equal((await request(app).put('/api/donantes/perfil').set(bearer(donante.token)).send({ id_colonia: 'abc' })).status, 400);
  });
});
