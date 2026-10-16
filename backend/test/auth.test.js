import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { descifrar, hashCURP } from '../src/utils/crypto.js';
import { prepararBaseDatos, idColonia, crearUsuarioHospital, contarFilas } from './helpers.js';

let coloniaCentroLaPaz;
let coloniaOtraLoreto;

function donante(cambios = {}) {
  return {
    email: 'juan.perez@example.com',
    password: 'MiPassword123',
    nombre_completo: 'Juan Perez Lopez',
    curp: 'PELJ950520HBSRPN01',
    fecha_nacimiento: '1995-05-20',
    sexo: 'M',
    telefono: '6121234567',
    id_tipo_sangre: 1,
    id_colonia: coloniaCentroLaPaz,
    peso_kg: 70,
    ...cambios
  };
}

const registrar = (datos) => request(app).post('/api/auth/registro').send(datos);

before(async () => {
  await prepararBaseDatos();
  coloniaCentroLaPaz = await idColonia('Centro', 'La Paz');
  coloniaOtraLoreto = await idColonia('Otra', 'Loreto');
});
after(cerrarPool);

describe('POST /api/auth/registro', () => {
  it('registra un donante y deriva la region de la colonia', async () => {
    const res = await registrar(donante());
    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.usuario.rol, 'donante');
    assert.equal(res.body.usuario.region, 'sur');
  });

  it('guarda nombre y telefono cifrados y el CURP como HMAC', async () => {
    const { rows } = await query('SELECT * FROM donantes WHERE id_usuario = (SELECT id FROM usuarios WHERE email = $1)', ['juan.perez@example.com']);
    const fila = rows[0];
    assert.notEqual(fila.nombre_cifrado, 'Juan Perez Lopez');
    assert.equal(descifrar(fila.nombre_cifrado), 'Juan Perez Lopez');
    assert.equal(descifrar(fila.telefono_cifrado), '6121234567');
    assert.equal(fila.curp_hash, hashCURP('PELJ950520HBSRPN01'));
    assert.equal(fila.region, 'sur');
    assert.equal(fila.disponible, true);
  });

  it('rechaza email duplicado (sin importar mayusculas)', async () => {
    const res = await registrar(donante({ email: 'JUAN.PEREZ@example.com', curp: 'PELJ950520HBSRPN02' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El email ya esta registrado');
  });

  it('rechaza CURP duplicado (sin importar mayusculas)', async () => {
    const res = await registrar(donante({ email: 'otro@example.com', curp: 'pelj950520hbsrpn01' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'El CURP ya esta registrado');
  });

  it('valida campos obligatorios, CURP, edad, sexo y peso', async () => {
    const casos = [
      [{ email: undefined }, /Faltan campos/],
      [{ email: 'no-es-email' }, /Email invalido/],
      [{ password: 'corta' }, /al menos 8/],
      [{ curp: 'XXXX' }, /CURP/],
      [{ fecha_nacimiento: '2015-01-01' }, /entre 18 y 65/],
      [{ fecha_nacimiento: '20-05-1995' }, /fecha_nacimiento invalida/],
      [{ sexo: 'X' }, /sexo/],
      [{ peso_kg: 45 }, /50 kg/],
      [{ latitud: 99999 }, /latitud/],
      [{ id_tipo_sangre: 99 }, /Tipo de sangre invalido/],
      [{ id_colonia: 9999 }, /Colonia no encontrada/]
    ];
    for (const [cambios, mensaje] of casos) {
      const res = await registrar(donante({ email: 'valida@example.com', curp: 'VALI950520HBSRPN03', ...cambios }));
      assert.equal(res.status, 400, JSON.stringify(cambios));
      assert.match(res.body.error, mensaje);
    }
  });

  it('colonia "Otra" exige colonia_personalizada y la guarda', async () => {
    const sinTexto = await registrar(donante({ email: 'otra@example.com', curp: 'OTRA950520HBSRPN04', id_colonia: coloniaOtraLoreto }));
    assert.equal(sinTexto.status, 400);

    const conTexto = await registrar(donante({
      email: 'otra@example.com', curp: 'OTRA950520HBSRPN04', id_colonia: coloniaOtraLoreto, colonia_personalizada: 'Zaragoza'
    }));
    assert.equal(conTexto.status, 201);
    assert.equal(conTexto.body.usuario.region, 'centro');
  });

  it('rechaza colonia_personalizada si la colonia no es "Otra"', async () => {
    const res = await registrar(donante({ email: 'mal@example.com', curp: 'MALC950520HBSRPN05', colonia_personalizada: 'X' }));
    assert.equal(res.status, 400);
  });

  it('es transaccional: si falla el INSERT del donante no queda usuario huerfano', async () => {
    const antes = await contarFilas('usuarios');
    // colonia_personalizada mayor a VARCHAR(150) hace fallar el segundo INSERT
    const res = await registrar(donante({
      email: 'huerfano@example.com', curp: 'HUER950520HBSRPN06', id_colonia: coloniaOtraLoreto, colonia_personalizada: 'x'.repeat(151)
    }));
    assert.equal(res.status, 500);
    assert.equal(res.body.ok, false);
    assert.equal(await contarFilas('usuarios'), antes);
  });

  it('400 y no 500 con ids no numericos o fechas inexistentes', async () => {
    const casos = [
      { email: 'f1@example.com', curp: 'FORM950520HBSRPN07', id_tipo_sangre: 'abc' },
      { email: 'f2@example.com', curp: 'FORM950520HBSRPN08', id_colonia: 'abc' },
      { email: 'f3@example.com', curp: 'FORM950520HBSRPN09', fecha_nacimiento: '1995-02-31' }
    ];
    for (const caso of casos) {
      const res = await registrar(donante(caso));
      assert.equal(res.status, 400, JSON.stringify(caso));
      assert.equal(res.body.ok, false);
    }
  });

  it('400 con JSON invalido', async () => {
    const res = await request(app).post('/api/auth/registro').set('Content-Type', 'application/json').send('{malo');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'JSON invalido');
  });
});

describe('POST /api/auth/login y GET /api/auth/perfil', () => {
  it('login correcto devuelve token valido', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'Juan.Perez@example.com', password: 'MiPassword123' });
    assert.equal(res.status, 200);
    const datos = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.equal(datos.rol, 'donante');
    assert.equal(datos.id_hospital, undefined);
  });

  it('401 con password incorrecta o email inexistente, mismo mensaje', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: 'juan.perez@example.com', password: 'incorrecta' });
    const b = await request(app).post('/api/auth/login').send({ email: 'nadie@example.com', password: 'incorrecta' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error, b.body.error);
  });

  it('400 si faltan credenciales', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    assert.equal(res.status, 400);
  });

  it('usuario hospital recibe id_hospital en el token', async () => {
    await crearUsuarioHospital('imss.lapaz@example.com', 'Hospital123', 1);
    const res = await request(app).post('/api/auth/login').send({ email: 'imss.lapaz@example.com', password: 'Hospital123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.usuario.id_hospital, 1);
  });

  it('403 si el usuario esta desactivado', async () => {
    await query("UPDATE usuarios SET activo = FALSE WHERE email = 'imss.lapaz@example.com'");
    const res = await request(app).post('/api/auth/login').send({ email: 'imss.lapaz@example.com', password: 'Hospital123' });
    assert.equal(res.status, 403);
  });

  it('perfil con token, 401 sin token o con token alterado', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'juan.perez@example.com', password: 'MiPassword123' });
    const ok = await request(app).get('/api/auth/perfil').set('Authorization', 'Bearer ' + login.body.token);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.usuario.email, 'juan.perez@example.com');

    assert.equal((await request(app).get('/api/auth/perfil')).status, 401);
    assert.equal((await request(app).get('/api/auth/perfil').set('Authorization', 'Bearer ' + login.body.token + 'x')).status, 401);
  });
});
