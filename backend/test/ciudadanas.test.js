import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { verificarLogs } from '../src/modules/auditoria/auditoria.service.js';
import { reiniciarCaducidad } from '../src/modules/solicitudes/solicitudes.service.js';
import { prepararBaseDatos, crearDonante, loginDemo, idColonia } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let autor;
let otroDonante;
let donanteCentro;
let tokenHospital1;
let tokenHospital2;
let tokenAdmin;
let idCancelada;
let idCritica;
let idActiva;
let creada;

// Las solicitudes piden O- (solo O- dona a O-); los autores extra son AB+ para no entrar como candidatos
const nuevoAutor = () => crearDonante(app, request, { id_tipo_sangre: 8 });

const pedir = (token, cambios = {}) => request(app).post('/api/solicitudes/ciudadana').set(bearer(token)).send({
  id_hospital: 1,
  id_tipo_sangre: 1,
  consentimiento: true,
  para_si_mismo: false,
  paciente_nombre: 'Paciente Prueba Uno',
  paciente_expediente: 'EXP-777',
  urgencia: 'urgente',
  ...cambios
});
const cerrar = (token, id, estado) => request(app).patch(`/api/solicitudes/${id}/cerrar`).set(bearer(token)).send({ estado });
const cambiarUrgencia = (token, id, urgencia) => request(app).patch(`/api/solicitudes/${id}/urgencia`).set(bearer(token)).send({ urgencia });
// El hospital 1 confirma que el paciente esta ahi: hasta entonces la solicitud no se publica ni avisa
const confirmar = (id, urgencia = 'urgente') => cambiarUrgencia(tokenHospital1, id, urgencia);
const INICIALES = 'P. P. U.';
const ofrecer = (token, id) => request(app).post('/api/notificaciones/ofrecerme').set(bearer(token)).send({ id_solicitud: id });
const responder = (token, id, respuesta) => request(app).patch(`/api/notificaciones/${id}/responder`).set(bearer(token)).send({ respuesta });

const fila = (id) => query('SELECT * FROM solicitudes WHERE id = $1', [id]).then((r) => r.rows[0]);
const faltasDe = (donante) => query('SELECT faltas FROM donantes WHERE id = $1', [donante.id_donante]).then((r) => r.rows[0].faltas);
const notificado = (id, donante) =>
  query('SELECT id FROM notificaciones WHERE id_solicitud = $1 AND id_donante = $2', [id, donante.id_donante]).then((r) => r.rows[0]);
const diasCaducidad = (id) =>
  query('SELECT EXTRACT(EPOCH FROM (fecha_caducidad - fecha_solicitud)) / 86400 AS dias FROM solicitudes WHERE id = $1', [id])
    .then((r) => Number(r.rows[0].dias));
const vencer = (id) => query("UPDATE solicitudes SET fecha_caducidad = NOW() - INTERVAL '1 minute' WHERE id = $1", [id])
  .then(() => reiniciarCaducidad());

before(async () => {
  await prepararBaseDatos();
  autor = await crearDonante(app, request, { id_tipo_sangre: 1 });
  otroDonante = await crearDonante(app, request, { id_tipo_sangre: 1 });
  donanteCentro = await crearDonante(app, request, { id_tipo_sangre: 1, id_colonia: await idColonia('Loreto Centro', 'Loreto') });
  tokenHospital1 = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenHospital2 = await loginDemo(app, request, 'hospital2@demo.donadores.mx', 'Hospital123');
  tokenAdmin = await loginDemo(app, request, 'admin@demo.donadores.mx', 'Admin12345');
});
after(cerrarPool);

describe('POST /api/solicitudes/ciudadana', () => {
  it('crea una solicitud ciudadana activa y caduca a los 7 dias (urgente) o 21 dias (normal)', async () => {
    const res = await pedir(autor.token);
    assert.equal(res.status, 201);
    const { solicitud } = res.body;
    assert.equal(solicitud.ciudadana, true);
    assert.equal(solicitud.estado, 'activa');
    assert.equal(solicitud.por_confirmar, true);
    assert.deepEqual(solicitud.paciente, { nombre: 'Paciente Prueba Uno', para_si_mismo: false, expediente: 'EXP-777' });
    assert.equal(solicitud.notificaciones, undefined);
    assert.equal(await diasCaducidad(solicitud.id), 7);
    idCancelada = solicitud.id;
    assert.equal((await cerrar(autor.token, idCancelada, 'cancelada')).status, 200);

    const normal = await pedir(autor.token, { urgencia: 'normal', paciente_expediente: null });
    assert.equal(normal.status, 201);
    assert.equal(normal.body.solicitud.paciente.expediente, null);
    assert.equal(await diasCaducidad(normal.body.solicitud.id), 21);
    assert.equal((await cerrar(autor.token, normal.body.solicitud.id, 'cancelada')).status, 200);
  });

  it('valida consentimiento, para_si_mismo, nombre, hospital, tipo, urgencia, unidades y largos', async () => {
    const invalidos = [
      { consentimiento: false },
      { consentimiento: undefined },
      { para_si_mismo: 'no' },
      { paciente_nombre: '  Al  ' },
      { paciente_nombre: 'x'.repeat(121) },
      { paciente_expediente: 'x'.repeat(41) },
      { descripcion: 'x'.repeat(501) },
      { id_hospital: undefined },
      { id_hospital: 999 },
      { id_hospital: 'abc' },
      { id_tipo_sangre: 99 },
      { urgencia: 'baja' },
      { unidades_requeridas: 21 }
    ];
    for (const cambios of invalidos) {
      const res = await pedir(autor.token, cambios);
      assert.equal(res.status, 400, JSON.stringify(cambios));
    }
    const sinConsentimiento = await pedir(autor.token, { consentimiento: false });
    assert.match(sinConsentimiento.body.error, /autorización/);
    const { rows } = await query("SELECT COUNT(*)::int AS total FROM solicitudes WHERE estado = 'activa'");
    assert.equal(rows[0].total, 0);
  });

  it('"critica" queda por confirmar con su urgencia y 72 h de caducidad, sin avisar a nadie', async () => {
    const autorCritica = await nuevoAutor();
    const res = await pedir(autorCritica.token, { urgencia: 'critica' });
    assert.equal(res.status, 201);
    assert.equal(res.body.solicitud.urgencia, 'critica');
    assert.equal(res.body.solicitud.por_confirmar, true);
    assert.equal(await diasCaducidad(res.body.solicitud.id), 3);
    idCritica = res.body.solicitud.id;

    assert.equal(await notificado(idCritica, otroDonante), undefined);
    assert.equal(await notificado(idCritica, donanteCentro), undefined);
  });

  it('solo donantes la crean', async () => {
    assert.equal((await pedir(tokenHospital1)).status, 403);
    assert.equal((await pedir(tokenAdmin)).status, 403);
    assert.equal((await request(app).post('/api/solicitudes/ciudadana').send({})).status, 401);
  });

  it('cifra nombre y expediente y no los escribe en auditoria_logs', async () => {
    creada = await pedir(autor.token, { descripcion: 'Cirugia el lunes' });
    assert.equal(creada.status, 201);
    idActiva = creada.body.solicitud.id;

    const guardada = await fila(idActiva);
    assert.ok(guardada.paciente_nombre_cifrado && !guardada.paciente_nombre_cifrado.includes('Paciente'));
    assert.ok(guardada.paciente_expediente_cifrado && !guardada.paciente_expediente_cifrado.includes('EXP-777'));
    assert.equal(guardada.id_usuario_autor, autor.id_usuario);

    const { rows } = await query(
      "SELECT COUNT(*)::int AS total FROM auditoria_logs WHERE detalles::text ILIKE '%Paciente Prueba%' OR detalles::text ILIKE '%EXP-777%'"
    );
    assert.equal(rows[0].total, 0);
  });

  it('no se publica ni avisa hasta que el hospital la confirma; al confirmarla avisa a la region sin el autor', async () => {
    assert.equal(creada.body.notificaciones_enviadas, undefined);
    const contar = () => query('SELECT COUNT(*)::int AS total FROM notificaciones WHERE id_solicitud = $1', [idActiva]).then((r) => r.rows[0].total);
    assert.equal(await contar(), 0);

    // Para los demas donantes todavia no existe
    const lista = await request(app).get('/api/solicitudes').set(bearer(otroDonante.token));
    assert.ok(!lista.body.solicitudes.some((s) => s.id === idActiva));
    assert.equal((await request(app).get(`/api/solicitudes/${idActiva}`).set(bearer(otroDonante.token))).status, 404);
    assert.equal((await ofrecer(otroDonante.token, idActiva)).status, 404);
    assert.equal((await request(app).post('/api/notificaciones/notificar').set(bearer(tokenHospital1)).send({ id_solicitud: idActiva })).status, 400);
    // El autor si la abre
    assert.equal((await request(app).get(`/api/solicitudes/${idActiva}`).set(bearer(autor.token))).status, 200);

    const res = await confirmar(idActiva);
    assert.equal(res.status, 200);
    assert.equal(res.body.solicitud.por_confirmar, false);
    assert.equal(res.body.notificaciones_enviadas, await contar());
    assert.ok(res.body.notificaciones_enviadas > 0);
    assert.ok(await notificado(idActiva, otroDonante));
    assert.equal(await notificado(idActiva, autor), undefined);
    assert.equal(await notificado(idActiva, donanteCentro), undefined);

    const { rows } = await query("SELECT detalles FROM auditoria_logs WHERE accion = 'SOLICITUD_CONFIRMADA' ORDER BY id DESC LIMIT 1");
    assert.equal(rows[0].detalles.id_solicitud, idActiva);
  });

  it('una sola activa por cuenta: la segunda responde 409', async () => {
    const res = await pedir(autor.token);
    assert.equal(res.status, 409);
    assert.match(res.body.error, /Ya tienes una solicitud activa/);
  });

  it('dos creaciones simultaneas del mismo autor: una 201 y otra 409', async () => {
    const otro = await nuevoAutor();
    const [a, b] = await Promise.all([pedir(otro.token), pedir(otro.token)]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    const { rows } = await query("SELECT COUNT(*)::int AS total FROM solicitudes WHERE id_usuario_autor = $1", [otro.id_usuario]);
    assert.equal(rows[0].total, 1);
  });
});

describe('visibilidad de las solicitudes ciudadanas', () => {
  it('otro donante ve solo las iniciales del paciente, en la lista, el detalle y su alerta, y nunca el expediente', async () => {
    const lista = await request(app).get('/api/solicitudes').set(bearer(otroDonante.token));
    const enLista = lista.body.solicitudes.find((s) => s.id === idActiva);
    assert.equal(enLista.paciente_nombre, INICIALES);
    assert.equal(enLista.ciudadana, true);
    assert.equal(JSON.stringify(lista.body).includes('Paciente Prueba'), false);
    assert.equal(JSON.stringify(lista.body).includes('EXP-777'), false);
    assert.equal(JSON.stringify(lista.body).includes('id_usuario_autor'), false);

    const detalle = await request(app).get(`/api/solicitudes/${idActiva}`).set(bearer(otroDonante.token));
    assert.equal(detalle.body.solicitud.paciente.nombre, INICIALES);
    assert.equal(detalle.body.solicitud.paciente.expediente, undefined);
    assert.equal(detalle.body.solicitud.notificaciones, undefined);

    const alertas = await request(app).get('/api/notificaciones/mis-notificaciones').set(bearer(otroDonante.token));
    assert.equal(alertas.body.notificaciones.find((n) => n.id_solicitud === idActiva).paciente_nombre, INICIALES);
  });

  it('el hospital elegido y admin ven nombre y expediente; otro hospital solo las iniciales', async () => {
    for (const token of [tokenHospital1, tokenAdmin]) {
      const res = await request(app).get(`/api/solicitudes/${idActiva}`).set(bearer(token));
      assert.equal(res.body.solicitud.paciente.nombre, 'Paciente Prueba Uno');
      assert.equal(res.body.solicitud.paciente.expediente, 'EXP-777');
      assert.ok(Array.isArray(res.body.solicitud.notificaciones));
    }
    const otro = await request(app).get(`/api/solicitudes/${idActiva}`).set(bearer(tokenHospital2));
    assert.equal(otro.body.solicitud.paciente.nombre, INICIALES);
    assert.equal(otro.body.solicitud.paciente.expediente, undefined);

    const lista = await request(app).get('/api/solicitudes').set(bearer(tokenHospital1));
    assert.equal(lista.body.solicitudes.find((s) => s.id === idActiva).paciente_nombre, 'Paciente Prueba Uno');
    assert.equal(JSON.stringify(lista.body).includes('EXP-777'), false);
    const listaOtro = await request(app).get('/api/solicitudes').set(bearer(tokenHospital2));
    assert.equal(listaOtro.body.solicitudes.find((s) => s.id === idActiva).paciente_nombre, INICIALES);
  });

  it('el donante no ve sus propias solicitudes en el listado general y no puede ofrecerse a ellas', async () => {
    const lista = await request(app).get('/api/solicitudes').set(bearer(autor.token));
    assert.ok(!lista.body.solicitudes.some((s) => s.id === idActiva));
    const ajena = await request(app).get('/api/solicitudes').set(bearer(otroDonante.token));
    assert.ok(ajena.body.solicitudes.some((s) => s.id === idActiva));

    const res = await ofrecer(autor.token, idActiva);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /propia solicitud/);
  });

  it('el autor ve todas las suyas en /mias con confirmaciones y unidades; hospital -> 403', async () => {
    const aviso = await notificado(idActiva, otroDonante);
    assert.equal((await responder(otroDonante.token, aviso.id, 'confirmada')).status, 200);

    const res = await request(app).get('/api/solicitudes/mias').set(bearer(autor.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.faltas, 0);
    const activa = res.body.solicitudes.find((s) => s.id === idActiva);
    assert.equal(activa.estado, 'activa');
    assert.equal(activa.paciente_nombre, 'Paciente Prueba Uno');
    assert.equal(activa.paciente_expediente, 'EXP-777');
    assert.equal(activa.confirmaciones, 1);
    assert.equal(activa.unidades_donadas, 0);
    assert.ok(activa.fecha_caducidad);
    assert.equal(res.body.solicitudes.filter((s) => s.estado === 'cancelada').length, 2);
    assert.equal(JSON.stringify(res.body).includes('id_donante'), false);

    assert.equal((await request(app).get('/api/solicitudes/mias').set(bearer(tokenHospital1))).status, 403);
  });

  it('el donante no lista ni abre solicitudes cerradas de otros', async () => {
    assert.equal((await request(app).get('/api/solicitudes?estado=falsa').set(bearer(otroDonante.token))).status, 403);
    assert.equal((await request(app).get('/api/solicitudes?estado=caducada').set(bearer(otroDonante.token))).status, 403);
    assert.equal((await request(app).get(`/api/solicitudes/${idCancelada}`).set(bearer(otroDonante.token))).status, 404);
    // El hospital si la abre
    assert.equal((await request(app).get(`/api/solicitudes/${idCancelada}`).set(bearer(tokenHospital1))).status, 200);
  });
});

describe('cancelar y marcar falsa', () => {
  it('el autor cancela su solicitud; no puede completarla (403) y otro donante recibe 404', async () => {
    assert.equal((await cerrar(otroDonante.token, idActiva, 'cancelada')).status, 404);
    assert.equal((await cerrar(autor.token, idActiva, 'completada')).status, 403);

    const res = await cerrar(autor.token, idActiva, 'cancelada');
    assert.equal(res.status, 200);
    assert.equal(res.body.solicitud.estado, 'cancelada');
    assert.equal(res.body.solicitud.notificaciones, undefined);
    assert.equal(res.body.solicitud.paciente.nombre, 'Paciente Prueba Uno');
    assert.equal(res.body.solicitud.paciente.expediente, undefined);
  });

  it('marcar falsa: solo hospital elegido o admin, solo ciudadanas, suma una falta', async () => {
    const autorFalso = await nuevoAutor();
    const id = (await pedir(autorFalso.token)).body.solicitud.id;

    assert.equal((await cerrar(tokenHospital2, id, 'falsa')).status, 403);
    assert.equal((await cerrar(autorFalso.token, id, 'falsa')).status, 403);
    const deHospital = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'urgente' });
    assert.equal((await cerrar(tokenHospital1, deHospital.body.solicitud.id, 'falsa')).status, 400);

    const res = await cerrar(tokenHospital1, id, 'falsa');
    assert.equal(res.status, 200);
    assert.equal(res.body.solicitud.estado, 'falsa');
    assert.ok(res.body.solicitud.fecha_cierre);
    assert.equal(await faltasDe(autorFalso), 1);

    // Una segunda falta solo con otra solicitud; con 2 ya no puede pedir
    const segunda = (await pedir(autorFalso.token)).body.solicitud.id;
    assert.equal((await cerrar(tokenAdmin, segunda, 'falsa')).status, 200);
    assert.equal(await faltasDe(autorFalso), 2);

    const bloqueada = await pedir(autorFalso.token);
    assert.equal(bloqueada.status, 403);
    const mias = await request(app).get('/api/solicitudes/mias').set(bearer(autorFalso.token));
    assert.equal(mias.body.faltas, 2);
  });

  it('el autor cancela y el hospital aun la marca falsa; lo mismo con una caducada; una completada no', async () => {
    const autorB = await nuevoAutor();
    const id = (await pedir(autorB.token)).body.solicitud.id;
    assert.equal((await cerrar(autorB.token, id, 'cancelada')).status, 200);
    const cierreOriginal = (await fila(id)).fecha_cierre.toISOString();

    const falsa = await cerrar(tokenHospital1, id, 'falsa');
    assert.equal(falsa.status, 200);
    assert.equal(await faltasDe(autorB), 1);
    const despues = await fila(id);
    assert.equal(despues.estado, 'falsa');
    assert.equal(despues.fecha_cierre.toISOString(), cierreOriginal);

    const caducada = (await pedir(autorB.token)).body.solicitud.id;
    await vencer(caducada);
    assert.equal((await cerrar(tokenHospital1, caducada, 'falsa')).status, 200);
    assert.equal(await faltasDe(autorB), 2);

    const autorC = await nuevoAutor();
    const completada = (await pedir(autorC.token)).body.solicitud.id;
    assert.equal((await cerrar(tokenHospital1, completada, 'completada')).status, 200);
    const res = await cerrar(tokenHospital1, completada, 'falsa');
    assert.equal(res.status, 400);
    assert.match(res.body.error, /completada/);
    assert.equal(await faltasDe(autorC), 0);
    // Tampoco se marca falsa dos veces
    assert.equal((await cerrar(tokenHospital1, id, 'falsa')).status, 400);
    assert.equal(await faltasDe(autorB), 2);
  });
});

describe('PATCH /api/solicitudes/:id/urgencia', () => {
  it('confirmar y cambiar urgencia: solo hospital elegido o admin y solo ciudadanas activas', async () => {
    const autorU = await nuevoAutor();
    const id = (await pedir(autorU.token, { urgencia: 'normal' })).body.solicitud.id;

    assert.equal((await cambiarUrgencia(tokenHospital2, id, 'urgente')).status, 403);
    assert.equal((await cambiarUrgencia(autorU.token, id, 'urgente')).status, 403);
    assert.equal((await cambiarUrgencia(tokenHospital1, id, 'baja')).status, 400);
    assert.equal((await cambiarUrgencia(tokenHospital1, idCancelada, 'urgente')).status, 400);
    assert.equal((await cambiarUrgencia(tokenHospital1, 99999, 'urgente')).status, 404);
    const deHospital = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'urgente' });
    assert.equal((await cambiarUrgencia(tokenHospital1, deHospital.body.solicitud.id, 'critica')).status, 400);

    // Confirmar con la misma urgencia que pidio el donante es valido; despues ya no
    const confirmada = await confirmar(id, 'normal');
    assert.equal(confirmada.status, 200);
    assert.equal(confirmada.body.solicitud.por_confirmar, false);
    assert.equal(typeof confirmada.body.notificaciones_enviadas, 'number');
    assert.equal((await confirmar(id, 'normal')).status, 400);

    const res = await cambiarUrgencia(tokenAdmin, id, 'urgente');
    assert.equal(res.status, 200);
    assert.equal(res.body.solicitud.urgencia, 'urgente');
    assert.equal(res.body.notificaciones_enviadas, 0);
    const { rows } = await query("SELECT detalles FROM auditoria_logs WHERE accion = 'URGENCIA_CAMBIADA' ORDER BY id DESC LIMIT 1");
    assert.deepEqual(rows[0].detalles, { id_solicitud: id, urgencia_anterior: 'normal', urgencia: 'urgente' });
  });

  it('confirmar critica quita la marca, reinicia la caducidad a 72 h y notifica a todo el estado', async () => {
    assert.equal(await notificado(idCritica, donanteCentro), undefined);

    const res = await confirmar(idCritica, 'critica');
    assert.equal(res.status, 200);
    assert.equal(res.body.solicitud.urgencia, 'critica');
    assert.equal(res.body.solicitud.por_confirmar, false);
    assert.ok(res.body.notificaciones_enviadas >= 1);
    assert.ok(await notificado(idCritica, donanteCentro));

    const { rows } = await query('SELECT EXTRACT(EPOCH FROM (fecha_caducidad - NOW())) / 3600 AS horas FROM solicitudes WHERE id = $1', [idCritica]);
    const horas = Number(rows[0].horas);
    assert.ok(horas > 71 && horas <= 72, String(horas));
  });

  it('confirmar como urgente una que se pidio critica avisa solo a la region del hospital', async () => {
    const autorP = await nuevoAutor();
    const id = (await pedir(autorP.token, { urgencia: 'critica' })).body.solicitud.id;

    const res = await confirmar(id, 'urgente');
    assert.equal(res.status, 200);
    assert.equal(res.body.solicitud.urgencia, 'urgente');
    assert.equal(res.body.solicitud.por_confirmar, false);
    assert.ok(await notificado(id, otroDonante));
    assert.equal(await notificado(id, donanteCentro), undefined);
  });
});

describe('caducidad y donaciones', () => {
  it('caducidad perezosa: listados, /mias, responder y ofrecerme la ven caducada', async () => {
    const autorV = await nuevoAutor();
    const primera = (await pedir(autorV.token)).body.solicitud.id;
    await vencer(primera);

    await request(app).get('/api/solicitudes').set(bearer(tokenHospital1));
    const vencida = await fila(primera);
    assert.equal(vencida.estado, 'caducada');
    assert.ok(vencida.fecha_cierre);

    const mias = await request(app).get('/api/solicitudes/mias').set(bearer(autorV.token));
    assert.equal(mias.body.solicitudes.find((s) => s.id === primera).estado, 'caducada');

    // Con la anterior caducada puede pedir otra
    const segunda = await pedir(autorV.token);
    assert.equal(segunda.status, 201);
    const idSegunda = segunda.body.solicitud.id;
    await confirmar(idSegunda);
    const aviso = await notificado(idSegunda, otroDonante);
    await vencer(idSegunda);

    const respuesta = await responder(otroDonante.token, aviso.id, 'confirmada');
    assert.equal(respuesta.status, 400);
    assert.match(respuesta.body.error, /ya no está activa/);
    assert.equal((await fila(idSegunda)).estado, 'caducada');

    const nuevo = await crearDonante(app, request, { id_tipo_sangre: 1 });
    assert.equal((await ofrecer(nuevo.token, idSegunda)).status, 400);
  });

  it('registrar donacion: permitida en caducada, bloqueada en falsa; con donacion ya no se marca falsa', async () => {
    const autorD = await nuevoAutor();
    const idCaducada = (await pedir(autorD.token)).body.solicitud.id;
    await confirmar(idCaducada);
    const donadorA = await crearDonante(app, request, { id_tipo_sangre: 1 });
    const ofrecidaA = await ofrecer(donadorA.token, idCaducada);
    assert.equal((await responder(donadorA.token, ofrecidaA.body.notificacion.id, 'confirmada')).status, 200);
    await vencer(idCaducada);
    const permitida = await request(app).patch(`/api/notificaciones/${ofrecidaA.body.notificacion.id}/donacion`).set(bearer(tokenHospital1)).send({ curp: donadorA.curp });
    assert.equal(permitida.status, 200);
    // registrarDonacion no caduca: activa y caducada se tratan igual ahi
    const detalle = await request(app).get(`/api/solicitudes/${idCaducada}`).set(bearer(tokenHospital1));
    assert.equal(detalle.body.solicitud.estado, 'caducada');
    assert.equal(detalle.body.solicitud.metricas.donaciones, 1);
    // Quien ya dono sigue contando como confirmado para el autor
    const mias = await request(app).get('/api/solicitudes/mias').set(bearer(autorD.token));
    const propia = mias.body.solicitudes.find((s) => s.id === idCaducada);
    assert.equal(propia.confirmaciones, 1);
    assert.equal(propia.unidades_donadas, 1);
    // Con una donacion registrada el paciente si estaba: ya no se marca falsa ni suma falta
    const conDonacion = await cerrar(tokenHospital1, idCaducada, 'falsa');
    assert.equal(conDonacion.status, 400);
    assert.match(conDonacion.body.error, /donaciones registradas/);
    assert.equal(await faltasDe(autorD), 0);

    const autorE = await nuevoAutor();
    const idFalsa = (await pedir(autorE.token)).body.solicitud.id;
    await confirmar(idFalsa);
    const donadorB = await crearDonante(app, request, { id_tipo_sangre: 1 });
    const ofrecidaB = await ofrecer(donadorB.token, idFalsa);
    assert.equal((await responder(donadorB.token, ofrecidaB.body.notificacion.id, 'confirmada')).status, 200);
    assert.equal((await cerrar(tokenHospital1, idFalsa, 'falsa')).status, 200);
    const bloqueada = await request(app).patch(`/api/notificaciones/${ofrecidaB.body.notificacion.id}/donacion`).set(bearer(tokenHospital1)).send({ curp: donadorB.curp });
    assert.equal(bloqueada.status, 400);
    assert.match(bloqueada.body.error, /falsa/);
  });

  it('las solicitudes de hospital aceptan normal, no caducan y no tienen paciente', async () => {
    const crear = (urgencia) => request(app).post('/api/solicitudes').set(bearer(tokenAdmin)).send({ id_hospital: 3, id_tipo_sangre: 2, urgencia });
    const normal = await crear('normal');
    assert.equal(normal.status, 201);
    assert.equal(normal.body.solicitud.urgencia, 'normal');
    assert.equal(normal.body.solicitud.ciudadana, false);
    assert.equal(normal.body.solicitud.paciente, null);
    assert.equal(normal.body.solicitud.fecha_caducidad, null);
    assert.equal((await fila(normal.body.solicitud.id)).fecha_caducidad, null);
    await crear('critica');
    await crear('urgente');

    const lista = await request(app).get('/api/solicitudes?id_hospital=3').set(bearer(tokenAdmin));
    assert.deepEqual(lista.body.solicitudes.map((s) => s.urgencia), ['critica', 'urgente', 'normal']);
    assert.equal(lista.body.solicitudes[0].paciente_nombre, null);
  });

  it('el dashboard cuenta falsas, caducadas y por confirmar; una critica por confirmar no es critica activa', async () => {
    const autorR = await nuevoAutor();
    assert.equal((await pedir(autorR.token, { urgencia: 'critica' })).status, 201);

    const res = await request(app).get('/api/reportes/dashboard').set(bearer(tokenAdmin));
    const { rows } = await query(`
      SELECT COUNT(*) FILTER (WHERE estado = 'falsa') AS falsas,
             COUNT(*) FILTER (WHERE estado = 'caducada') AS caducadas,
             COUNT(*) FILTER (WHERE estado = 'activa' AND por_confirmar) AS por_confirmar,
             COUNT(*) FILTER (WHERE estado = 'activa' AND urgencia = 'critica' AND NOT por_confirmar) AS criticas_activas
      FROM solicitudes
    `);
    const { falsas, caducadas, por_confirmar: porConfirmar, criticas_activas: criticasActivas } = res.body.dashboard.solicitudes;
    assert.deepEqual({ falsas, caducadas, por_confirmar: porConfirmar, criticas_activas: criticasActivas }, rows[0]);
    assert.ok(falsas >= 4);
    assert.ok(caducadas >= 3);
    assert.ok(porConfirmar >= 1);
  });

  it('la cadena global de logs sigue integra', async () => {
    const verificacion = await verificarLogs();
    assert.equal(verificacion.integra, true);
    const { rows } = await query(
      "SELECT COUNT(*)::int AS total FROM auditoria_logs WHERE detalles::text ILIKE '%Paciente Prueba%' OR detalles::text ILIKE '%EXP-777%'"
    );
    assert.equal(rows[0].total, 0);
  });
});
