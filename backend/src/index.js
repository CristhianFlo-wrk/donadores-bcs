import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { pathToFileURL } from 'url';
import { probarConexion, cerrarPool } from './config/database.js';
import { validarEntorno } from './config/entorno.js';
import { ErrorHttp, esDatoInvalidoPg } from './utils/errores.js';
import { limitarGeneral } from './middleware/limiteIntentos.js';
import { obtenerEstado, purgarIpsVencidas } from './modules/auditoria/auditoria.service.js';
import { purgarPublicacionVencida } from './modules/solicitudes/solicitudes.service.js';
import ubicacionesRoutes from './modules/ubicaciones/ubicaciones.routes.js';
import hospitalesRoutes from './modules/hospitales/hospitales.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import donantesRoutes from './modules/donantes/donantes.routes.js';
import solicitudesRoutes from './modules/solicitudes/solicitudes.routes.js';
import auditoriaRoutes from './modules/auditoria/auditoria.routes.js';
import notificacionesRoutes from './modules/notificaciones/notificaciones.routes.js';
import reportesRoutes from './modules/reportes/reportes.routes.js';

export const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// lista separada por comas; Sin valor se permite cualquier origen (solo desarrollo)
function opcionesCors() {
  const origenes = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  return origenes.length > 0 ? { origin: origenes } : {};
}

app.use(helmet());
app.use(cors(opcionesCors()));
if (process.env.NODE_ENV !== 'test') app.use(morgan('[SERVER] :method :url :status :response-time ms'));
// La solicitud ciudadana puede traer hasta 3 fotos (600 KB cada una, un tercio mas en base64); el resto, el limite normal de 100 KB
app.use('/api/solicitudes/ciudadana', express.json({ limit: '3mb' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    servidor: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Despues de /api/health para que el ping no cuente
app.use('/api', limitarGeneral);

app.use('/api/ubicaciones', ubicacionesRoutes);
app.use('/api/hospitales', hospitalesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/donantes', donantesRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/reportes', reportesRoutes);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// Express manda errores no capturados, incluidos los de funciones async
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'JSON inválido' });
  }
  if (error instanceof ErrorHttp) {
    return res.status(error.status).json({ ok: false, error: error.message });
  }
  if (esDatoInvalidoPg(error)) {
    return res.status(400).json({ ok: false, error: 'Dato con formato inválido' });
  }
  console.error('[ERROR] ' + req.method + ' ' + req.originalUrl + ': ' + error.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

async function iniciar() {
  const errores = validarEntorno(process.env);
  if (errores.length > 0) {
    errores.forEach((mensaje) => console.error('[ERROR] ' + mensaje));
    process.exit(1);
  }

  const conectado = await probarConexion();
  if (!conectado) {
    console.error('[ERROR] No se puede iniciar el servidor sin conexion a la base de datos');
    process.exit(1);
  }

  const servidor = app.listen(PORT, (error) => {
    if (error) {
      console.error('[ERROR] [SERVER] No se pudo abrir el puerto ' + PORT + ': ' + error.message);
      process.exit(1);
    }
    console.log('[SERVER] Servidor corriendo en puerto ' + PORT);
  });

  
  const mantenimiento = async () => {
    try {
      await purgarPublicacionVencida();
    } catch (error) {
      console.error('[ERROR] [SOLICITUDES] Fallo el borrado de fotos y mensajes vencidos: ' + error.message);
    }
    try {
      await purgarIpsVencidas();
      const estado = await obtenerEstado({ completa: true });
      for (const [nombre, verificacion] of [['donaciones', estado.verificacion_donaciones], ['bitacora', estado.verificacion_logs]]) {
        if (verificacion.integra) console.log('[AUDITORIA] Verificacion completa de ' + nombre + ': ' + verificacion.total + ' registros integros');
        else console.error('[ERROR] [AUDITORIA] Cadena de ' + nombre + ' alterada en el registro ' + verificacion.id_roto + ': ' + verificacion.mensaje);
      }
    } catch (error) {
      console.error('[ERROR] [AUDITORIA] Fallo el mantenimiento diario: ' + error.message);
    }
  };
  mantenimiento();
  setInterval(mantenimiento, 24 * 60 * 60 * 1000).unref();

  // Render manda SIGTERM al redesplegar: se terminan las peticiones en curso y se cierra el pool
  const apagar = (senal) => {
    console.log('[SERVER] ' + senal + ' recibido, cerrando servidor');
    servidor.close(async () => {
      await cerrarPool();
      console.log('[DB] Pool cerrado');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
}

const esEjecucionDirecta = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  iniciar();
}
