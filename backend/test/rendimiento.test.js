import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { prepararBaseDatos, loginDemo, contarFilas } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });
const TOTAL_DONANTES = 150;
const LIMITE_MS = 3000;

let tokenHospital;

//la busqueda de compatibles no debe tardar mas de 3 segundos con al menos 100 registros
before(async () => {
  await prepararBaseDatos();
  tokenHospital = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');

  // Carga directa por SQL: el registro por API tardaria por bcrypt y no es lo que se mide
  await query(`
    INSERT INTO usuarios (email, password_hash, rol)
    SELECT 'carga' || i || '@test.com', 'sin-uso', 'donante' FROM generate_series(1, $1) AS i
  `, [TOTAL_DONANTES]);
  await query(`
    INSERT INTO donantes (id_usuario, nombre_cifrado, curp_hash, fecha_nacimiento, id_tipo_sangre, id_colonia, region)
    SELECT u.id, 'sin-uso', encode(sha256(u.email::bytea), 'hex'), '1990-01-01', 1 + (u.id % 8), c.id, m.region
    FROM usuarios u
    JOIN colonias c ON c.id = 1 + (u.id % (SELECT COUNT(*) FROM colonias))
    JOIN municipios m ON c.id_municipio = m.id
    WHERE u.email LIKE 'carga%'
  `);
});
after(cerrarPool);

describe('rendimiento con carga de donantes (RNF-02)', () => {
  it('hay al menos 100 donantes cargados', async () => {
    assert.ok(await contarFilas('donantes') >= 100);
  });

  it('GET /api/donantes/compatibles responde en menos de 3 segundos', async () => {
    const inicio = performance.now();
    const res = await request(app).get('/api/donantes/compatibles/8?limite=100').set(bearer(tokenHospital));
    const duracion = performance.now() - inicio;

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 100);
    assert.ok(duracion < LIMITE_MS, 'tardo ' + Math.round(duracion) + ' ms');
  });

  it('crear y notificar una solicitud critica a todo el estado tarda menos de 3 segundos', async () => {
    const inicio = performance.now();
    const solicitud = await request(app).post('/api/solicitudes').set(bearer(tokenHospital)).send({ id_tipo_sangre: 8, urgencia: 'critica' });
    const res = await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital))
      .send({ id_solicitud: solicitud.body.solicitud.id, limite: 100 });
    const duracion = performance.now() - inicio;

    assert.equal(res.status, 200);
    assert.equal(res.body.notificaciones_enviadas, 100);
    assert.ok(duracion < LIMITE_MS, 'tardo ' + Math.round(duracion) + ' ms');
  });
});
