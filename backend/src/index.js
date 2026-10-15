import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { pathToFileURL } from 'url';
import { probarConexion } from './config/database.js';
import { ErrorHttp } from './utils/errores.js';
import ubicacionesRoutes from './modules/ubicaciones/ubicaciones.routes.js';
import hospitalesRoutes from './modules/hospitales/hospitales.routes.js';
import authRoutes from './modules/auth/auth.routes.js';

const VARIABLES_REQUERIDAS = ['DATABASE_URL', 'AES_KEY', 'JWT_SECRET', 'HASH_KEY'];

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
if (process.env.NODE_ENV !== 'test') app.use(morgan('[SERVER] :method :url :status :response-time ms'));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    servidor: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/ubicaciones', ubicacionesRoutes);
app.use('/api/hospitales', hospitalesRoutes);
app.use('/api/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// Express 5 manda aqui los errores no capturados, incluidos los de funciones async
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'JSON invalido' });
  }
  if (error instanceof ErrorHttp) {
    return res.status(error.status).json({ ok: false, error: error.message });
  }
  console.error('[ERROR] ' + req.method + ' ' + req.originalUrl + ': ' + error.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

async function iniciar() {
  const faltantes = VARIABLES_REQUERIDAS.filter((nombre) => !process.env[nombre]);
  if (faltantes.length > 0) {
    console.error('[ERROR] Faltan variables de entorno: ' + faltantes.join(', '));
    process.exit(1);
  }

  const conectado = await probarConexion();
  if (!conectado) {
    console.error('[ERROR] No se puede iniciar el servidor sin conexion a la base de datos');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('[SERVER] Servidor corriendo en puerto ' + PORT);
  });
}

const esEjecucionDirecta = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  iniciar();
}
