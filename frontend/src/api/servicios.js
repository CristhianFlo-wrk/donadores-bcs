import { api, pedirArchivo } from './cliente.js';

function conConsulta(ruta, filtros = {}) {
  const parametros = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor !== undefined && valor !== null && valor !== ''));
  const consulta = parametros.toString();
  return ruta + (consulta ? '?' + consulta : '');
}

export const ubicaciones = {
  municipios: () => api.get('/ubicaciones/municipios'),
  colonias: (idMunicipio, filtros) => api.get(conConsulta('/ubicaciones/colonias/' + idMunicipio, filtros)),
  crearColonia: (datos) => api.post('/ubicaciones/colonias', datos),
  editarColonia: (id, cambios) => api.patch('/ubicaciones/colonias/' + id, cambios),
  cambiarActivoColonia: (id, activo) => api.patch('/ubicaciones/colonias/' + id + '/activo', { activo }),
  tiposSangre: () => api.get('/ubicaciones/tipos-sangre')
};

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  registro: (datos) => api.post('/auth/registro', datos),
  perfil: () => api.get('/auth/perfil'),
  usuarios: (filtros) => api.get(conConsulta('/auth/usuarios', filtros)),
  crearUsuario: (datos) => api.post('/auth/usuarios', datos),
  cambiarActivo: (id, activo) => api.patch('/auth/usuarios/' + id + '/activo', { activo })
};

export const donantes = {
  perfil: () => api.get('/donantes/perfil'),
  actualizarPerfil: (cambios) => api.put('/donantes/perfil', cambios),
  disponibilidad: (disponible) => api.patch('/donantes/disponibilidad', { disponible }),
  stats: () => api.get('/donantes/stats')
};

export const hospitales = {
  listar: (filtros) => api.get(conConsulta('/hospitales', filtros)),
  crear: (datos) => api.post('/hospitales', datos),
  editar: (id, cambios) => api.patch('/hospitales/' + id, cambios),
  cambiarActivo: (id, activo) => api.patch('/hospitales/' + id + '/activo', { activo }),
  obtener: (id) => api.get('/hospitales/' + id)
};

export const solicitudes = {
  listar: (filtros) => api.get(conConsulta('/solicitudes', filtros)),
  obtener: (id) => api.get('/solicitudes/' + id),
  crear: (datos) => api.post('/solicitudes', datos),
  crearCiudadana: (datos) => api.post('/solicitudes/ciudadana', datos),
  mias: () => api.get('/solicitudes/mias'),
  candidatos: (id) => api.get('/solicitudes/' + id + '/candidatos'),
  cerrar: (id, estado) => api.patch('/solicitudes/' + id + '/cerrar', { estado }),
  cambiarUrgencia: (id, urgencia) => api.patch('/solicitudes/' + id + '/urgencia', { urgencia }),
  imagen: (id, idImagen) => pedirArchivo('/solicitudes/' + id + '/imagenes/' + idImagen),
  quitarImagen: (id, idImagen) => api.delete('/solicitudes/' + id + '/imagenes/' + idImagen),
  quitarHistoria: (id) => api.delete('/solicitudes/' + id + '/historia')
};

export const notificaciones = {
  notificar: (datos) => api.post('/notificaciones/notificar', datos),
  mias: () => api.get('/notificaciones/mis-notificaciones'),
  confirmadas: () => api.get('/notificaciones/confirmadas'),
  ofrecerme: (idSolicitud) => api.post('/notificaciones/ofrecerme', { id_solicitud: idSolicitud }),
  responder: (id, respuesta) => api.patch('/notificaciones/' + id + '/responder', { respuesta }),
  registrarDonacion: (id, curp) => api.patch('/notificaciones/' + id + '/donacion', { curp })
};

export const auditoria = {
  miHistorial: () => api.get('/auditoria/mi-historial'),
  porNotificacion: (idNotificacion) => api.get('/auditoria/notificacion/' + idNotificacion),
  estado: (opciones) => api.get(conConsulta('/auditoria/estado', opciones || {})),
  bitacora: (filtros) => api.get(conConsulta('/auditoria/bitacora', filtros)),
  eslabon: (id) => api.get('/auditoria/bitacora/' + id + '/eslabon'),
  emitirConstancia: () => api.post('/auditoria/constancias'),
  comprobarConstancia: (datos) => api.post('/auditoria/constancias/comprobar', datos)
};

export const reportes = {
  dashboard: (idHospital) => api.get(conConsulta('/reportes/dashboard', { id_hospital: idHospital }))
};
