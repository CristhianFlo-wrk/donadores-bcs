import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { getDb } from '../config/database.js';
import { NODOS } from '../config/nodos.js';
import blockchainRoutes from '../modules/blockchain/blockchain.routes.js';
import ubicacionesRoutes from '../modules/ubicaciones/ubicaciones.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import donantesRoutes from '../modules/donantes/donantes.routes.js';
import solicitudesRoutes from '../modules/solicitudes/solicitudes.routes.js';
import hospitalesRoutes from '../modules/hospitales/hospitales.routes.js';
import notificacionesRoutes from '../modules/notificaciones/notificaciones.routes.js';


const app = express();
const NODO = NODOS.sur;
const db = getDb('sur');

app.use(helmet());
app.use(cors());
app.use(morgan(`[SUR] :method :url :status`));
app.use(express.json());

app.use((req, res, next) => {
  req.nodo = NODO;
  req.db = db;
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    nodo: NODO.id,
    nombre: NODO.nombre,
    municipios: NODO.municipios,
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/blockchain', blockchainRoutes);
app.use('/api/ubicaciones', ubicacionesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/donantes', donantesRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/hospitales', hospitalesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

app.listen(NODO.puerto, () => {
  console.log(`${NODO.nombre} en http://localhost:${NODO.puerto}`);
});