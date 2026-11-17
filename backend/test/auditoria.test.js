import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query, transaccion } from '../src/config/database.js';
import { registrarEntrada, registrarLog, verificarHistorial, verificarLogs, purgarIpsVencidas } from '../src/modules/auditoria/auditoria.service.js';
import { prepararBaseDatos, crearDonante, loginDemo } from './helpers.js';
import { generarHashEntrada, HASH_GENESIS } from '../src/utils/hash.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

const canonico = (v) => {
  const ordenar = (x) => (Array.isArray(x) ? x.map(ordenar) : x && typeof x === 'object'
    ? Object.keys(x).sort().reduce((o, k) => ({ ...o, [k]: ordenar(x[k]) }), {}) : x);
  return v === null || v === undefined ? '' : JSON.stringify(ordenar(v));
};

let donante;
let hashDonante;
let tokenAdmin;
let tokenHospital;
let tokenAuditor;

const donar = (idHospital = 1, region = 'sur') =>
  transaccion((client) => registrarEntrada(client, { idDonanteHash: hashDonante, grupoSanguineo: 'O-', idHospital, region }));

before(async () => {
  await prepararBaseDatos();
  donante = await crearDonante(app, request);
  const { rows } = await query('SELECT curp_hash FROM donantes WHERE id = $1', [donante.id_donante]);
  hashDonante = rows[0].curp_hash;
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');
  tokenHospital = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenAuditor = await loginDemo(app, request, 'auditor@demo.donadores.mx', 'Auditor123');
});
after(cerrarPool);

describe('cadena de historial_donaciones', () => {
  it('encadena entradas y verifica despues de leerlas de PostgreSQL', async () => {
    const primera = await donar(1, 'sur');
    const segunda = await donar(4, 'centro');
    assert.notEqual(segunda.hash_actual, primera.hash_actual);
    const { rows } = await query('SELECT octet_length(hash_actual) AS bytes FROM historial_donaciones WHERE id = $1', [primera.id]);
    assert.equal(rows[0].bytes, 32);

    const verificacion = await verificarHistorial(hashDonante);
    assert.equal(verificacion.integra, true);
    assert.equal(verificacion.total, 2);
  });

  it('dos donaciones simultaneas del mismo donante no bifurcan la cadena', async () => {
    await Promise.all([donar(), donar(), donar()]);
    const verificacion = await verificarHistorial(hashDonante);
    assert.equal(verificacion.integra, true);
    assert.equal(verificacion.total, 5);
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
      INSERT INTO historial_donaciones (id, id_donante_hash, fecha_donacion, grupo_sanguineo, id_hospital, region, hash_actual, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [f.id, f.id_donante_hash, f.fecha_donacion, f.grupo_sanguineo, f.id_hospital, f.region, f.hash_actual, f.created_at]);
    assert.equal((await verificarHistorial(hashDonante)).integra, true);
  });
});

describe('cadena global de auditoria_logs', () => {
  it('las acciones de los modulos quedan registradas', async () => {
    await request(app).patch('/api/donantes/disponibilidad').set(bearer(donante.token)).send({ disponible: false });
    await request(app).post('/api/auth/login').send({ email: donante.email, password: 'incorrecta' });
    await request(app).post('/api/solicitudes').set(bearer(tokenHospital)).send({ id_tipo_sangre: 1, urgencia: 'urgente' });

    const { rows } = await query('SELECT accion FROM auditoria_logs ORDER BY id');
    const acciones = rows.map((r) => r.accion);
    for (const accion of ['REGISTRO_DONANTE', 'LOGIN_EXITOSO', 'DISPONIBILIDAD_CAMBIADA', 'LOGIN_FALLIDO', 'SOLICITUD_CREADA']) {
      assert.ok(acciones.includes(accion), accion);
    }
  });

  it('un login fallido con un correo que no existe no entra a la cadena', async () => {
    const antes = (await query('SELECT COUNT(*)::int AS total FROM auditoria_logs')).rows[0].total;
    const res = await request(app).post('/api/auth/login').send({ email: 'nadie@test.com', password: 'incorrecta' });
    assert.equal(res.status, 401);
    assert.equal((await query('SELECT COUNT(*)::int AS total FROM auditoria_logs')).rows[0].total, antes);
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

  it('a la cadena entra la huella de la IP: la IP en claro se vigila y se borra al vencer su plazo sin romper la cadena', async () => {
    const { id } = await registrarLog(null, { accion: 'PRUEBA_IP', ipOrigen: '187.190.12.34' });
    const fila = (await query("SELECT ip_origen, encode(ip_hmac, 'hex') AS ip_hmac, octet_length(hash_actual) AS bytes FROM auditoria_logs WHERE id = $1", [id])).rows[0];
    assert.equal(fila.ip_origen, '187.190.12.34');
    assert.match(fila.ip_hmac, /^[0-9a-f]{64}$/);
    assert.equal(fila.bytes, 32);
    assert.equal((await verificarLogs()).integra, true);

    await query("UPDATE auditoria_logs SET ip_origen = '10.0.0.1' WHERE id = $1", [id]);
    let verificacion = await verificarLogs();
    assert.equal(verificacion.integra, false);
    assert.equal(verificacion.id_roto, id);
    assert.match(verificacion.mensaje, /IP no coincide/);

    await query('UPDATE auditoria_logs SET ip_origen = NULL WHERE id = $1', [id]);
    verificacion = await verificarLogs();
    assert.equal(verificacion.integra, false);
    assert.match(verificacion.mensaje, /antes de su plazo/);

    // Plazo de 0 dias: todo log ya vencio. Se restauran las IPs para que los demas tests verifiquen con el plazo normal
    await query("UPDATE auditoria_logs SET ip_origen = '187.190.12.34' WHERE id = $1", [id]);
    const respaldo = (await query('SELECT id, ip_origen FROM auditoria_logs WHERE ip_origen IS NOT NULL')).rows;
    assert.equal(await purgarIpsVencidas(0), respaldo.length);
    assert.equal((await query('SELECT COUNT(*)::int AS total FROM auditoria_logs WHERE ip_origen IS NOT NULL')).rows[0].total, 0);
    // El borrado queda en la bitacora como accion del sistema; sin nada que borrar no se anota
    const purga = await query("SELECT id_usuario, detalles FROM auditoria_logs WHERE accion = 'IPS_BORRADAS_POR_PLAZO'");
    assert.deepEqual(purga.rows, [{ id_usuario: null, detalles: { ips_borradas: respaldo.length, plazo_dias: 0 } }]);
    assert.equal(await purgarIpsVencidas(0), 0);
    assert.equal((await query("SELECT COUNT(*)::int AS total FROM auditoria_logs WHERE accion = 'IPS_BORRADAS_POR_PLAZO'")).rows[0].total, 1);
    assert.equal((await verificarLogs(0)).integra, true);
    for (const { id: idLog, ip_origen: ip } of respaldo) {
      await query('UPDATE auditoria_logs SET ip_origen = $1 WHERE id = $2', [ip, idLog]);
    }
    assert.equal((await verificarLogs()).integra, true);
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

  it('el estado global verifica las dos cadenas completas', async () => {
    const estado = await request(app).get('/api/auditoria/estado').set(bearer(tokenAdmin));
    assert.equal(estado.body.estado.total_donaciones, 5);
    assert.equal(estado.body.estado.donantes_con_historial, 1);
    assert.ok(estado.body.estado.total_logs > 0);
    assert.equal(estado.body.estado.verificacion_donaciones.integra, true);
    assert.equal(estado.body.estado.verificacion_logs.integra, true);
  });

  it('el estado global detecta una donacion o un log alterados', async () => {
    const { rows } = await query('SELECT id, id_hospital FROM historial_donaciones ORDER BY id LIMIT 1');
    await query('UPDATE historial_donaciones SET id_hospital = 2 WHERE id = $1', [rows[0].id]);
    await query("UPDATE auditoria_logs SET accion = 'OTRA' WHERE id = 1");

    const { estado } = (await request(app).get('/api/auditoria/estado?completa=true').set(bearer(tokenAdmin))).body;
    assert.equal(estado.verificacion_donaciones.integra, false);
    assert.equal(estado.verificacion_donaciones.id_roto, rows[0].id);
    assert.equal(estado.verificacion_logs.integra, false);
    assert.equal(estado.verificacion_logs.modo, 'completa');

    await query('UPDATE historial_donaciones SET id_hospital = $1 WHERE id = $2', [rows[0].id_hospital, rows[0].id]);
    await query("UPDATE auditoria_logs SET accion = 'REGISTRO_DONANTE' WHERE id = 1");
    const limpio = (await request(app).get('/api/auditoria/estado?completa=true').set(bearer(tokenAdmin))).body.estado;
    assert.equal(limpio.verificacion_donaciones.integra, true);
    assert.equal(limpio.verificacion_logs.integra, true);
  });

  it('la verificacion rapida revisa solo lo nuevo y una alteracion detectada queda senalada hasta una completa', async () => {
    const logs = async (consulta = '') => (await request(app).get('/api/auditoria/estado' + consulta).set(bearer(tokenAdmin))).body.estado.verificacion_logs;

    const base = await logs();
    assert.equal(base.integra, true);
    assert.equal(base.modo, 'rapida');
    assert.ok(base.ultima_completa);
    // Lo nuevo: este log y, si toco registrarla, la consulta anterior (una por usuario cada 10 minutos)
    await registrarLog(null, { accion: 'PRUEBA_RAPIDA' });
    const ultimo = Number((await query('SELECT MAX(id) AS id FROM auditoria_logs')).rows[0].id);
    const nueva = await logs();
    assert.equal(nueva.verificado_hasta, ultimo);
    assert.equal(nueva.revisados, ultimo - base.verificado_hasta);
    assert.ok(nueva.revisados >= 1);

    // Una alteracion vieja no la ve la rapida; la completa si, y desde ahi la rapida la sigue mostrando
    await query("UPDATE auditoria_logs SET accion = 'OTRA' WHERE id = 1");
    assert.equal((await logs()).integra, true);
    const completa = await logs('?completa=true');
    assert.equal(completa.integra, false);
    assert.equal(completa.id_roto, 1);
    assert.equal((await logs()).integra, false);
    await query("UPDATE auditoria_logs SET accion = 'REGISTRO_DONANTE' WHERE id = 1");
    assert.equal((await logs()).integra, false);
    assert.equal((await logs('?completa=true')).integra, true);
    assert.equal((await logs()).integra, true);

    // Lo nuevo si lo revisa la rapida, incluido el ultimo registro ya verificado
    const { id } = await registrarLog(null, { accion: 'PRUEBA_NUEVA' });
    await query("UPDATE auditoria_logs SET accion = 'OTRA' WHERE id = $1", [id]);
    const rota = await logs();
    assert.equal(rota.integra, false);
    assert.equal(rota.id_roto, id);
    await query("UPDATE auditoria_logs SET accion = 'PRUEBA_NUEVA' WHERE id = $1", [id]);
    assert.equal((await logs('?completa=true')).integra, true);

    // El registro del punto de control (cada consulta deja un log, asi que es el de la ultima consulta)
    const idControl = (await query("SELECT id_hasta FROM auditoria_puntos_control WHERE cadena = 'logs'")).rows[0].id_hasta;
    const { rows } = await query('SELECT hash_actual FROM auditoria_logs WHERE id = $1', [idControl]);
    await query("UPDATE auditoria_logs SET hash_actual = decode(repeat('0', 64), 'hex') WHERE id = $1", [idControl]);
    const control = await logs();
    assert.equal(control.integra, false);
    assert.equal(control.id_roto, idControl);
    await query('UPDATE auditoria_logs SET hash_actual = $1 WHERE id = $2', [rows[0].hash_actual, idControl]);
    assert.equal((await logs('?completa=true')).integra, true);
  });

  it('el admin consulta la bitacora con quien, que, cuando e IP, filtra y pagina', async () => {
    const res = await request(app).get('/api/auditoria/bitacora?limite=3').set(bearer(tokenAdmin));
    assert.equal(res.status, 200);
    assert.equal(res.body.entradas.length, 3);
    assert.equal(res.body.hay_mas, true);
    const [primera, segunda] = res.body.entradas;
    assert.ok(primera.id > segunda.id);
    for (const campo of ['fecha', 'accion', 'ip_origen', 'detalles', 'hash_actual', 'email', 'rol']) {
      assert.ok(campo in primera, campo);
    }

    const siguiente = await request(app).get('/api/auditoria/bitacora?limite=3&antes=' + res.body.entradas[2].id).set(bearer(tokenAdmin));
    assert.ok(siguiente.body.entradas.every((e) => e.id < res.body.entradas[2].id));

    const registros = await request(app).get('/api/auditoria/bitacora?accion=REGISTRO_DONANTE').set(bearer(tokenAdmin));
    assert.ok(registros.body.entradas.length > 0);
    assert.ok(registros.body.entradas.every((e) => e.accion === 'REGISTRO_DONANTE' && e.email === donante.email));
    assert.equal(registros.body.hay_mas, false);

    assert.equal((await request(app).get('/api/auditoria/bitacora?antes=abc').set(bearer(tokenAdmin))).status, 400);
  });

  it('la bitacora filtra por categoria de acciones, usuario, hospital, region y fechas', async () => {
    const bitacora = async (filtros) => {
      const res = await request(app).get('/api/auditoria/bitacora?limite=100&' + new URLSearchParams(filtros)).set(bearer(tokenAdmin));
      assert.equal(res.status, 200);
      return res.body.entradas;
    };

    const sesiones = await bitacora({ accion: 'LOGIN_EXITOSO,LOGIN_FALLIDO' });
    assert.ok(sesiones.some((e) => e.accion === 'LOGIN_FALLIDO'));
    assert.ok(sesiones.every((e) => ['LOGIN_EXITOSO', 'LOGIN_FALLIDO'].includes(e.accion)));

    const delHospital1 = await bitacora({ usuario: 'HOSPITAL1@demo' });
    assert.ok(delHospital1.length > 0);
    assert.ok(delHospital1.every((e) => e.email === 'hospital1@demo.donadores.mx'));

    const porHospital = await bitacora({ id_hospital: 1 });
    assert.ok(porHospital.some((e) => e.accion === 'SOLICITUD_CREADA'));
    assert.ok(porHospital.every((e) => e.id_hospital === 1 && e.hospital_nombre));

    const { rows } = await query('SELECT region FROM donantes WHERE id = $1', [donante.id_donante]);
    const porRegion = await bitacora({ region: rows[0].region });
    assert.ok(porRegion.some((e) => e.accion === 'REGISTRO_DONANTE'));
    assert.ok(porRegion.every((e) => e.region === rows[0].region));

    const dias = (await query(`
      SELECT to_char((NOW() AT TIME ZONE 'America/Mazatlan')::date, 'YYYY-MM-DD') AS hoy,
             to_char((NOW() AT TIME ZONE 'America/Mazatlan')::date + 1, 'YYYY-MM-DD') AS manana
    `)).rows[0];
    assert.ok((await bitacora({ desde: dias.hoy, hasta: dias.hoy })).length > 0);
    assert.equal((await bitacora({ desde: dias.manana })).length, 0);

    for (const filtros of [{ desde: dias.manana, hasta: dias.hoy }, { desde: '2026-13-45' }, { region: 'oeste' }, { id_hospital: 'x' }]) {
      const res = await request(app).get('/api/auditoria/bitacora?' + new URLSearchParams(filtros)).set(bearer(tokenAdmin));
      assert.equal(res.status, 400, JSON.stringify(filtros));
    }
  });

  it('el auditor lee la auditoria, su consulta queda registrada y no puede modificar nada', async () => {
    const estado = await request(app).get('/api/auditoria/estado').set(bearer(tokenAuditor));
    assert.equal(estado.status, 200);
    const { rows } = await query("SELECT u.rol FROM auditoria_logs l JOIN usuarios u ON l.id_usuario = u.id WHERE l.accion = 'AUDITORIA_CONSULTADA' ORDER BY l.id DESC LIMIT 1");
    assert.equal(rows[0].rol, 'auditor');
    // Volver a consultar enseguida no agrega otro registro
    const contar = async () => Number((await query("SELECT COUNT(*) FROM auditoria_logs l JOIN usuarios u ON l.id_usuario = u.id WHERE l.accion = 'AUDITORIA_CONSULTADA' AND u.rol = 'auditor'")).rows[0].count);
    const antes = await contar();
    assert.equal((await request(app).get('/api/auditoria/estado').set(bearer(tokenAuditor))).status, 200);
    assert.equal(await contar(), antes);
    assert.equal((await request(app).get('/api/auditoria/bitacora').set(bearer(tokenAuditor))).status, 200);
    assert.equal((await request(app).get('/api/auditoria/bitacora/1/eslabon').set(bearer(tokenAuditor))).status, 200);

    const prohibidas = [
      request(app).get('/api/auth/usuarios').set(bearer(tokenAuditor)),
      request(app).post('/api/auth/usuarios').set(bearer(tokenAuditor)).send({ email: 'x@x.com', password: 'Password123', rol: 'admin' }),
      request(app).patch('/api/auth/usuarios/1/activo').set(bearer(tokenAuditor)).send({ activo: false }),
      request(app).post('/api/solicitudes').set(bearer(tokenAuditor)).send({ id_hospital: 1, id_tipo_sangre: 1, urgencia: 'urgente' }),
      request(app).patch('/api/solicitudes/1/cerrar').set(bearer(tokenAuditor)).send({ estado: 'cancelada' }),
      request(app).get('/api/reportes/dashboard').set(bearer(tokenAuditor)),
      request(app).get('/api/auditoria/notificacion/1').set(bearer(tokenAuditor))
    ];
    for (const res of await Promise.all(prohibidas)) assert.equal(res.status, 403, res.req.path);
  });

  it('el eslabon trae todo lo necesario para recalcular el sello fuera del servidor', async () => {
    const { rows } = await query("SELECT id FROM auditoria_logs WHERE accion = 'REGISTRO_DONANTE' ORDER BY id DESC LIMIT 1");
    const res = await request(app).get('/api/auditoria/bitacora/' + rows[0].id + '/eslabon').set(bearer(tokenAdmin));
    const { campos, sello_anterior: anterior, sello } = res.body.eslabon;
    const recalculado = generarHashEntrada([campos.id_usuario, campos.accion, canonico(campos.detalles), campos.ip_hmac, campos.fecha], anterior);
    assert.equal(recalculado, sello);
    assert.equal(res.body.eslabon.coincide_servidor, true);

    const primero = await request(app).get('/api/auditoria/bitacora/1/eslabon').set(bearer(tokenAdmin));
    assert.equal(primero.body.eslabon.sello_anterior, HASH_GENESIS);
    assert.equal(primero.body.eslabon.id_anterior, null);
    assert.equal((await request(app).get('/api/auditoria/bitacora/999999/eslabon').set(bearer(tokenAdmin))).status, 404);
  });

  it('la constancia detecta lo que la verificacion interna no puede: una historia reescrita por completo', async () => {
    const emitida = await request(app).post('/api/auditoria/constancias').set(bearer(tokenAuditor));
    assert.equal(emitida.status, 201);
    const { constancia } = emitida.body;
    assert.match(constancia.sello, /^[0-9a-f]{64}$/);
    assert.ok(constancia.folio > constancia.logs_hasta);

    const comprobar = (cambios = {}) => request(app).post('/api/auditoria/constancias/comprobar').set(bearer(tokenAuditor))
      .send({ logs_hasta: constancia.logs_hasta, donaciones_hasta: constancia.donaciones_hasta, sello: constancia.sello.slice(0, 16).toUpperCase().match(/.{4}/g).join('-'), ...cambios });

    const buena = await comprobar();
    assert.equal(buena.status, 200);
    assert.equal(buena.body.comprobacion.resultado, 'coincide');
    assert.equal((await comprobar({ sello: 'ffff'.repeat(4) })).body.comprobacion.resultado, 'sello_distinto');
    assert.equal((await comprobar({ logs_hasta: 999999 })).body.comprobacion.resultado, 'registro_inexistente');
    assert.equal((await comprobar({ sello: 'corto' })).status, 400);

    // Alteracion torpe: la cadena se rompe y la constancia lo dice
    await query("UPDATE auditoria_logs SET accion = 'OTRA' WHERE id = 1");
    const torpe = (await comprobar()).body.comprobacion;
    assert.equal(torpe.resultado, 'cadena_alterada');
    assert.equal(torpe.id_roto, 1);

    // Atacante con acceso a la base: deja el registro 1 cambiado y vuelve a sellar toda la cadena
    const resellar = async () => {
      const filas = (await query("SELECT id, id_usuario, accion, detalles, encode(ip_hmac, 'hex') AS ip_hmac, fecha FROM auditoria_logs ORDER BY id")).rows;
      let anterior = HASH_GENESIS;
      for (const f of filas) {
        anterior = generarHashEntrada([f.id_usuario, f.accion, canonico(f.detalles), f.ip_hmac, f.fecha], anterior);
        await query("UPDATE auditoria_logs SET hash_actual = decode($1, 'hex') WHERE id = $2", [anterior, f.id]);
      }
    };
    await resellar();
    assert.equal((await verificarLogs()).integra, true);
    assert.equal((await comprobar()).body.comprobacion.resultado, 'sello_distinto');

    // Con el dato real de vuelta, sellar de nuevo reproduce exactamente los sellos originales
    await query("UPDATE auditoria_logs SET accion = 'REGISTRO_DONANTE' WHERE id = 1");
    await resellar();
    assert.equal((await comprobar()).body.comprobacion.resultado, 'coincide');
    const { rows } = await query("SELECT detalles FROM auditoria_logs WHERE accion = 'CONSTANCIA_COMPROBADA' ORDER BY id DESC LIMIT 1");
    assert.equal(rows[0].detalles.resultado, 'coincide');
  });

  it('hospitales y donantes no acceden a los endpoints de admin', async () => {
    for (const token of [tokenHospital, donante.token]) {
      assert.equal((await request(app).get('/api/auditoria/estado').set(bearer(token))).status, 403);
      assert.equal((await request(app).get('/api/auditoria/bitacora').set(bearer(token))).status, 403);
      assert.equal((await request(app).post('/api/auditoria/constancias').set(bearer(token))).status, 403);
      assert.equal((await request(app).get('/api/auditoria/bitacora/1/eslabon').set(bearer(token))).status, 403);
    }
    assert.equal((await request(app).get('/api/auditoria/mi-historial').set(bearer(tokenHospital))).status, 403);
  });

  it('no hay endpoints de consulta por hash ni de registro', async () => {
    assert.equal((await request(app).get('/api/auditoria/verificar/' + hashDonante).set(bearer(tokenAdmin))).status, 404);
    assert.equal((await request(app).get('/api/auditoria/historial/' + hashDonante).set(bearer(tokenAdmin))).status, 404);
    assert.equal((await request(app).post('/api/auditoria/registrar').set(bearer(tokenAdmin)).send({})).status, 404);
  });
});
