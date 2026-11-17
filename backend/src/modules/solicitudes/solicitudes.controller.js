import {
  ESTADOS,
  crearSolicitud,
  crearSolicitudCiudadana,
  obtenerSolicitudBase,
  obtenerSolicitudPorId,
  listarSolicitudes,
  listarSolicitudesAutor,
  buscarCandidatos,
  cerrarSolicitud,
  cambiarUrgencia,
  obtenerImagen,
  quitarImagen,
  quitarHistoria,
  verificarAccesoHospital,
  veNombreCompleto
} from './solicitudes.service.js';
import { enviarNotificaciones } from '../notificaciones/notificaciones.service.js';
import { validarRegion } from '../../config/regiones.js';
import { parsearId, parsearLimite, parsearFecha, errorValidacion, errorNoEncontrado, ErrorHttp } from '../../utils/errores.js';
import { contextoDe } from '../auditoria/auditoria.service.js';

export async function postSolicitud(req, res) {
  const body = req.body || {};
  let idHospital;

  if (req.usuario.rol === 'hospital') {
    idHospital = req.usuario.id_hospital;
    if (body.id_hospital !== undefined && Number(body.id_hospital) !== idHospital) {
      throw new ErrorHttp(403, 'Un usuario hospital solo puede crear solicitudes para su hospital');
    }
  } else {
    if (body.id_hospital === undefined) {
      throw errorValidacion('id_hospital es obligatorio');
    }
    idHospital = parsearId(body.id_hospital, 'id_hospital');
  }

  const solicitud = await crearSolicitud(idHospital, body, contextoDe(req));
  res.status(201).json({ ok: true, solicitud });
}

// El donante pide sangre: queda por confirmar y no avisa a nadie hasta que el hospital la confirme
export async function postSolicitudCiudadana(req, res) {
  const idSolicitud = await crearSolicitudCiudadana(req.usuario.id, req.body || {}, contextoDe(req));
  const solicitud = await obtenerSolicitudPorId(idSolicitud, { incluirExpediente: true });
  res.status(201).json({ ok: true, solicitud });
}

export async function getMisSolicitudes(req, res) {
  const { faltas, solicitudes } = await listarSolicitudesAutor(req.usuario.id);
  res.json({ ok: true, total: solicitudes.length, faltas, solicitudes });
}

// El donante solo ve solicitudes activas de otros; hospital y admin ven cualquier estado
export async function getSolicitudes(req, res) {
  let estado = req.query.estado || null;
  const esDonante = req.usuario.rol === 'donante';
  if (esDonante) {
    if (ESTADOS.includes(estado) && estado !== 'activa') {
      throw new ErrorHttp(403, 'Un donante solo puede consultar solicitudes activas');
    }
    // Un estado invalido llega tal cual al service, que responde 400
    estado = estado || 'activa';
  }

  const busqueda = filtrosBusqueda(req.query);
  let idHospital = req.query.id_hospital ? parsearId(req.query.id_hospital, 'id_hospital') : null;
  // Un hospital solo busca en sus solicitudes: un codigo N-0000 ajeno no debe revelar a que solicitud pertenece
  if (busqueda.texto && req.usuario.rol === 'hospital') {
    idHospital = req.usuario.id_hospital;
  }

  const solicitudes = await listarSolicitudes(req.usuario, {
    ...busqueda,
    estado,
    idHospital,
    region: validarRegion(req.query.region),
    limite: parsearLimite(req.query.limite),
    excluirAutor: esDonante ? req.usuario.id : null,
    soloConfirmadas: esDonante
  });
  res.json({ ok: true, total: solicitudes.length, solicitudes });
}

const ORIGENES = ['ciudadana', 'hospital'];

// q: texto libre (#id, codigo N-0000, paciente, descripcion u hospital); el resto son filtros exactos
function filtrosBusqueda(consulta) {
  const texto = typeof consulta.q === 'string' ? consulta.q.trim() : '';
  if (texto.length > 100) {
    throw errorValidacion('q admite como maximo 100 caracteres');
  }
  if (consulta.origen && !ORIGENES.includes(consulta.origen)) {
    throw errorValidacion('origen debe ser "ciudadana" o "hospital"');
  }
  const desde = parsearFecha(consulta.desde, 'desde');
  const hasta = parsearFecha(consulta.hasta, 'hasta');
  if (desde && hasta && desde > hasta) {
    throw errorValidacion('desde no puede ser posterior a hasta');
  }

  return {
    texto: texto || null,
    idTipoSangre: consulta.id_tipo_sangre ? parsearId(consulta.id_tipo_sangre, 'id_tipo_sangre') : null,
    urgencia: consulta.urgencia || null,
    origen: consulta.origen || null,
    desde,
    hasta
  };
}

function verificarVisible(usuario, base) {
  const esAutor = base.id_usuario_autor === usuario.id;
  if (usuario.rol === 'donante' && (base.estado !== 'activa' || (base.por_confirmar && !esAutor))) {
    throw errorNoEncontrado('Solicitud no encontrada');
  }
}

export async function getSolicitud(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const base = await obtenerSolicitudBase(idSolicitud);

  const { rol, id_hospital: idHospital } = req.usuario;
  verificarVisible(req.usuario, base);
  const incluirNotificaciones = rol === 'admin' || (rol === 'hospital' && idHospital === base.id_hospital);

  const solicitud = await obtenerSolicitudPorId(idSolicitud, {
    incluirNotificaciones,
    nombreCompleto: veNombreCompleto(req.usuario, base.id_hospital, base.id_usuario_autor)
  });
  res.json({ ok: true, solicitud });
}

export async function getImagen(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const idImagen = parsearId(req.params.idImagen, 'idImagen');
  verificarVisible(req.usuario, await obtenerSolicitudBase(idSolicitud));

  const datos = await obtenerImagen(idSolicitud, idImagen);
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(datos);
}

export async function deleteImagen(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const idImagen = parsearId(req.params.idImagen, 'idImagen');
  verificarAccesoHospital(req.usuario, (await obtenerSolicitudBase(idSolicitud)).id_hospital);

  await quitarImagen(idSolicitud, idImagen, contextoDe(req));
  const solicitud = await obtenerSolicitudPorId(idSolicitud, { incluirNotificaciones: true });
  res.json({ ok: true, solicitud });
}

export async function deleteHistoria(req, res) {
  const idSolicitud = parsearId(req.params.id);
  verificarAccesoHospital(req.usuario, (await obtenerSolicitudBase(idSolicitud)).id_hospital);

  await quitarHistoria(idSolicitud, contextoDe(req));
  const solicitud = await obtenerSolicitudPorId(idSolicitud, { incluirNotificaciones: true });
  res.json({ ok: true, solicitud });
}

export async function getCandidatos(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const base = await obtenerSolicitudBase(idSolicitud);
  verificarAccesoHospital(req.usuario, base.id_hospital);

  const resultado = await buscarCandidatos(idSolicitud, {
    region: validarRegion(req.query.region),
    limite: parsearLimite(req.query.limite)
  });
  res.json({ ok: true, ...resultado });
}

// Hospital y admin completan, cancelan o marcan falsa; el donante autor solo cancela la suya
export async function patchCerrar(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const { estado } = req.body || {};
  if (!estado) {
    throw errorValidacion('Campo "estado" es obligatorio');
  }

  const base = await obtenerSolicitudBase(idSolicitud);
  let opcionesRespuesta;

  if (req.usuario.rol === 'donante') {
    // 404 antes de mirar el estado, para no revelar solicitudes ajenas
    if (base.id_usuario_autor !== req.usuario.id) {
      throw errorNoEncontrado('Solicitud no encontrada');
    }
    if (estado !== 'cancelada') {
      throw new ErrorHttp(403, 'Solo puedes cancelar tu solicitud');
    }
    opcionesRespuesta = { incluirNotificaciones: false, nombreCompleto: true };
  } else {
    verificarAccesoHospital(req.usuario, base.id_hospital);
    if (estado === 'falsa' && base.id_usuario_autor === null) {
      throw errorValidacion('Solo se marca como falsa una solicitud ciudadana');
    }
  }

  const solicitud = await cerrarSolicitud(idSolicitud, estado, contextoDe(req), opcionesRespuesta);
  res.json({ ok: true, solicitud });
}

export async function patchUrgencia(req, res) {
  const idSolicitud = parsearId(req.params.id);
  const { urgencia } = req.body || {};
  if (!urgencia) {
    throw errorValidacion('Campo "urgencia" es obligatorio');
  }

  const base = await obtenerSolicitudBase(idSolicitud);
  verificarAccesoHospital(req.usuario, base.id_hospital);

  const contexto = contextoDe(req);
  const recienConfirmada = await cambiarUrgencia(idSolicitud, urgencia, contexto);

  let notificacionesEnviadas = 0;
  if (recienConfirmada || urgencia === 'critica') {
    // Se relee: la base de antes del cambio tiene la urgencia y la marca anteriores
    const envio = await enviarNotificaciones(await obtenerSolicitudBase(idSolicitud), {}, contexto);
    notificacionesEnviadas = envio.notificaciones_enviadas;
  }

  const solicitud = await obtenerSolicitudPorId(idSolicitud, { incluirNotificaciones: true });
  res.json({ ok: true, solicitud, notificaciones_enviadas: notificacionesEnviadas });
}
