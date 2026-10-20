import { api } from './cliente.js';

function conConsulta(ruta, filtros = {}) {
  const parametros = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor !== undefined && valor !== null && valor !== ''));
  const consulta = parametros.toString();
  return ruta + (consulta ? '?' + consulta : '');
}

export const ubicaciones = {
  municipios: () => api.get('/ubicaciones/municipios'),
  colonias: (idMunicipio) => api.get('/ubicaciones/colonias/' + idMunicipio),
  tiposSangre: () => api.get('/ubicaciones/tipos-sangre')
};

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  registro: (datos) => api.post('/auth/registro', datos),
  perfil: () => api.get('/auth/perfil'),
  usuarios: (rol) => api.get(conConsulta('/auth/usuarios', { rol })),
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
  listar: () => api.get('/hospitales'),
  obtener: (id) => api.get('/hospitales/' + id)
};

export const solicitudes = {
  listar: (filtros) => api.get(conConsulta('/solicitudes', filtros)),
  obtener: (id) => api.get('/solicitudes/' + id),
  crear: (datos) => api.post('/solicitudes', datos),
  candidatos: (id) => api.get('/solicitudes/' + id + '/candidatos'),
  cerrar: (id, estado) => api.patch('/solicitudes/' + id + '/cerrar', { estado })
};

export const notificaciones = {
  notificar: (datos) => api.post('/notificaciones/notificar', datos),
  mias: () => api.get('/notificaciones/mis-notificaciones'),
  responder: (id, respuesta) => api.patch('/notificaciones/' + id + '/responder', { respuesta }),
  registrarDonacion: (id) => api.patch('/notificaciones/' + id + '/donacion')
};

export const auditoria = {
  miHistorial: () => api.get('/auditoria/mi-historial'),
  porNotificacion: (idNotificacion) => api.get('/auditoria/notificacion/' + idNotificacion),
  estado: () => api.get('/auditoria/estado'),
  verificar: (hash) => api.get('/auditoria/verificar/' + hash)
};

export const reportes = {
  dashboard: (idHospital) => api.get(conConsulta('/reportes/dashboard', { id_hospital: idHospital }))
};
