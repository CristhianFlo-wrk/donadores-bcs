import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/index.js';
import { cerrarPool, query } from '../src/config/database.js';
import { limpiarJpeg } from '../src/utils/imagenes.js';
import { purgarPublicacionVencida } from '../src/modules/solicitudes/solicitudes.service.js';
import { prepararBaseDatos, crearDonante, loginDemo } from './helpers.js';

const bearer = (token) => ({ Authorization: 'Bearer ' + token });

let autor;
let otroAutor;
let lector;
let tokenHospital1;
let tokenHospital2;
let solicitud;

// JPEG minimo bien formado: inicio, JFIF, EXIF opcional con una "ubicacion", inicio de imagen comprimida y fin
function jpeg({ exif = false, relleno = 0 } = {}) {
  const segmento = (marcador, contenido) => {
    const cabecera = Buffer.from([0xff, marcador, 0, 0]);
    cabecera.writeUInt16BE(contenido.length + 2, 2);
    return Buffer.concat([cabecera, contenido]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segmento(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    ...(exif ? [segmento(0xe1, Buffer.from('Exif\0\0GPS 24.1426 -110.3128', 'latin1'))] : []),
    segmento(0xda, Buffer.alloc(10, 0x22)),
    Buffer.alloc(relleno, 0x11),
    Buffer.from([0xff, 0xd9])
  ]);
}
const comoDataUrl = (buffer) => 'data:image/jpeg;base64,' + buffer.toString('base64');

const pedir = (token, cambios = {}) => request(app).post('/api/solicitudes/ciudadana').set(bearer(token)).send({
  id_hospital: 1,
  id_tipo_sangre: 1,
  urgencia: 'urgente',
  consentimiento: true,
  para_si_mismo: false,
  paciente_nombre: 'Rosa Elena Pérez',
  ...cambios
});
const verImagen = (token, idSolicitud, idImagen) =>
  request(app).get(`/api/solicitudes/${idSolicitud}/imagenes/${idImagen}`).set(bearer(token)).responseType('blob');

before(async () => {
  await prepararBaseDatos();
  autor = await crearDonante(app, request, { id_tipo_sangre: 8 });
  otroAutor = await crearDonante(app, request, { id_tipo_sangre: 8 });
  lector = await crearDonante(app, request, { id_tipo_sangre: 1 });
  tokenHospital1 = await loginDemo(app, request, 'hospital1@demo.donadores.mx', 'Hospital123');
  tokenHospital2 = await loginDemo(app, request, 'hospital2@demo.donadores.mx', 'Hospital123');
});
after(cerrarPool);

describe('limpiarJpeg', () => {
  it('quita el EXIF y conserva la imagen', () => {
    const limpia = limpiarJpeg(jpeg({ exif: true }));
    assert.ok(limpia);
    assert.equal(limpia.includes('Exif'), false);
    assert.deepEqual(limpia, jpeg());
  });

  it('rechaza lo que no es un JPEG bien formado', () => {
    assert.equal(limpiarJpeg(Buffer.from('no soy una foto')), null);
    assert.equal(limpiarJpeg(jpeg().subarray(0, 12)), null);
  });
});

describe('POST /api/solicitudes/ciudadana con mensaje y fotos', () => {
  it('valida fotos, mensaje y la autorizacion para mostrarlos', async () => {
    const foto = comoDataUrl(jpeg());
    assert.equal((await pedir(otroAutor.token, { historia: 'Hola' })).status, 400);
    assert.equal((await pedir(otroAutor.token, { imagenes: [foto], consentimiento_publico: false })).status, 400);
    assert.equal((await pedir(otroAutor.token, { imagenes: [foto, foto, foto, foto], consentimiento_publico: true })).status, 400);
    assert.equal((await pedir(otroAutor.token, { imagenes: 'foto', consentimiento_publico: true })).status, 400);
    assert.equal((await pedir(otroAutor.token, { imagenes: ['data:image/png;base64,iVBORw0KGgo='], consentimiento_publico: true })).status, 400);
    assert.equal((await pedir(otroAutor.token, { imagenes: [comoDataUrl(Buffer.from('texto'))], consentimiento_publico: true })).status, 400);
    assert.equal((await pedir(otroAutor.token, { imagenes: [comoDataUrl(jpeg({ relleno: 700 * 1024 }))], consentimiento_publico: true })).status, 400);
    assert.equal((await pedir(otroAutor.token, { historia: 'a'.repeat(1001), consentimiento_publico: true })).status, 400);
    const { rows } = await query('SELECT COUNT(*)::int AS total FROM solicitudes');
    assert.equal(rows[0].total, 0);
  });

  it('guarda el mensaje y las fotos sin EXIF; la bitacora solo anota cuantas', async () => {
    const res = await pedir(autor.token, {
      historia: 'Mi mamá está internada desde el lunes.',
      imagenes: [comoDataUrl(jpeg({ exif: true })), comoDataUrl(jpeg())],
      consentimiento_publico: true
    });
    assert.equal(res.status, 201);
    solicitud = res.body.solicitud;
    assert.equal(solicitud.historia, 'Mi mamá está internada desde el lunes.');
    assert.equal(solicitud.imagenes.length, 2);

    const guardada = await query('SELECT datos FROM solicitud_imagenes WHERE id = $1', [solicitud.imagenes[0].id]);
    assert.equal(guardada.rows[0].datos.includes('Exif'), false);

    const log = await query("SELECT detalles FROM auditoria_logs WHERE accion = 'SOLICITUD_CREADA' ORDER BY id DESC LIMIT 1");
    assert.equal(log.rows[0].detalles.imagenes, 2);
    assert.equal(log.rows[0].detalles.con_historia, true);
    assert.equal(JSON.stringify(log.rows[0].detalles).includes('mamá'), false);
  });

  it('el hospital ve las fotos para revisarla; otro donante no hasta que se confirme', async () => {
    const delHospital = await verImagen(tokenHospital1, solicitud.id, solicitud.imagenes[0].id);
    assert.equal(delHospital.status, 200);
    assert.equal(delHospital.headers['content-type'], 'image/jpeg');
    assert.deepEqual(Buffer.from(delHospital.body), jpeg());

    assert.equal((await verImagen(autor.token, solicitud.id, solicitud.imagenes[0].id)).status, 200);
    assert.equal((await verImagen(lector.token, solicitud.id, solicitud.imagenes[0].id)).status, 404);
  });

  it('al confirmarla los donantes ven el mensaje y las fotos', async () => {
    await request(app).patch(`/api/solicitudes/${solicitud.id}/urgencia`).set(bearer(tokenHospital1)).send({ urgencia: 'urgente' });

    const detalle = await request(app).get(`/api/solicitudes/${solicitud.id}`).set(bearer(lector.token));
    assert.equal(detalle.body.solicitud.historia, 'Mi mamá está internada desde el lunes.');
    assert.equal(detalle.body.solicitud.imagenes.length, 2);
    assert.equal((await verImagen(lector.token, solicitud.id, solicitud.imagenes[1].id)).status, 200);

    const lista = await request(app).get('/api/solicitudes').set(bearer(lector.token));
    const fila = lista.body.solicitudes.find((s) => s.id === solicitud.id);
    assert.equal(fila.tiene_historia, true);
    assert.equal(fila.total_imagenes, 2);
  });

  it('una foto de otra solicitud no se sirve con este id', async () => {
    assert.equal((await verImagen(tokenHospital1, solicitud.id, 999999)).status, 404);
    assert.equal((await verImagen(tokenHospital1, solicitud.id, 'x')).status, 400);
  });

  it('una solicitud del hospital no trae mensaje ni fotos', async () => {
    const res = await request(app).post('/api/solicitudes').set(bearer(tokenHospital1)).send({ id_tipo_sangre: 2, urgencia: 'normal' });
    assert.equal(res.body.solicitud.historia, null);
    assert.deepEqual(res.body.solicitud.imagenes, []);
  });
});

describe('moderacion del mensaje y las fotos', () => {
  const quitarImagen = (token, idImagen) => request(app).delete(`/api/solicitudes/${solicitud.id}/imagenes/${idImagen}`).set(bearer(token));
  const quitarHistoria = (token) => request(app).delete(`/api/solicitudes/${solicitud.id}/historia`).set(bearer(token));

  it('solo el hospital dueno o el admin las quitan', async () => {
    assert.equal((await quitarImagen(tokenHospital2, solicitud.imagenes[0].id)).status, 403);
    assert.equal((await quitarImagen(lector.token, solicitud.imagenes[0].id)).status, 403);
    assert.equal((await quitarHistoria(autor.token)).status, 403);
  });

  it('el hospital quita una foto y el mensaje, y queda en la bitacora', async () => {
    const sinFoto = await quitarImagen(tokenHospital1, solicitud.imagenes[0].id);
    assert.equal(sinFoto.status, 200);
    assert.deepEqual(sinFoto.body.solicitud.imagenes.map((i) => i.id), [solicitud.imagenes[1].id]);
    assert.equal((await verImagen(tokenHospital1, solicitud.id, solicitud.imagenes[0].id)).status, 404);
    assert.equal((await quitarImagen(tokenHospital1, solicitud.imagenes[0].id)).status, 404);

    const sinMensaje = await quitarHistoria(tokenHospital1);
    assert.equal(sinMensaje.status, 200);
    assert.equal(sinMensaje.body.solicitud.historia, null);
    assert.equal((await quitarHistoria(tokenHospital1)).status, 400);

    const { rows } = await query("SELECT accion FROM auditoria_logs WHERE accion IN ('IMAGEN_QUITADA', 'HISTORIA_QUITADA') ORDER BY id");
    assert.deepEqual(rows.map((r) => r.accion), ['IMAGEN_QUITADA', 'HISTORIA_QUITADA']);
  });

  it('cerrada la solicitud, los donantes ya no ven sus fotos', async () => {
    await request(app).patch(`/api/solicitudes/${solicitud.id}/cerrar`).set(bearer(autor.token)).send({ estado: 'cancelada' });
    assert.equal((await verImagen(lector.token, solicitud.id, solicitud.imagenes[1].id)).status, 404);
    assert.equal((await verImagen(tokenHospital1, solicitud.id, solicitud.imagenes[1].id)).status, 200);
  });
});

describe('borrado de fotos y mensaje a los 30 dias del cierre', () => {
  const fotosDe = (id) => query('SELECT COUNT(*)::int AS total FROM solicitud_imagenes WHERE id_solicitud = $1', [id]).then((r) => r.rows[0].total);
  const historiaDe = (id) => query('SELECT historia FROM solicitudes WHERE id = $1', [id]).then((r) => r.rows[0].historia);
  const cerradaHace = (id, dias) => query("UPDATE solicitudes SET fecha_cierre = NOW() - make_interval(days => $2) WHERE id = $1", [id, dias]);

  it('conserva lo de las activas y de las cerradas hace menos de 30 dias; borra lo demas', async () => {
    const activa = (await pedir(otroAutor.token, { historia: 'Sigue activa', imagenes: [comoDataUrl(jpeg())], consentimiento_publico: true })).body.solicitud;
    // Una activa con fecha de cierre vieja no debe tocarse aunque el dato sea raro
    await cerradaHace(activa.id, 40);
    // El hospital quito el mensaje en la moderacion; se repone para probar su borrado
    await query("UPDATE solicitudes SET historia = 'Mensaje viejo' WHERE id = $1", [solicitud.id]);

    await cerradaHace(solicitud.id, 29);
    assert.deepEqual(await purgarPublicacionVencida(), { fotos: 0, mensajes: 0 });
    assert.equal(await fotosDe(solicitud.id), 1);
    assert.equal(await historiaDe(solicitud.id), 'Mensaje viejo');

    const purgas = () => query("SELECT id_usuario, detalles FROM auditoria_logs WHERE accion = 'PUBLICACIONES_BORRADAS_POR_PLAZO'").then((r) => r.rows);
    assert.deepEqual(await purgas(), []);

    await cerradaHace(solicitud.id, 31);
    assert.deepEqual(await purgarPublicacionVencida(), { fotos: 1, mensajes: 1 });
    assert.deepEqual(await purgas(), [{ id_usuario: null, detalles: { fotos: 1, mensajes: 1, plazo_dias: 30 } }]);
    assert.equal(await fotosDe(solicitud.id), 0);
    assert.equal(await historiaDe(solicitud.id), null);
    assert.equal(await fotosDe(activa.id), 1);
    assert.equal(await historiaDe(activa.id), 'Sigue activa');
  });
});
