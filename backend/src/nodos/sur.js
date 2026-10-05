import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { getDb } from '../config/database.js';
import { NODOS } from '../config/nodos.js';
import blockchainRoutes from '../modules/blockchain/blockchain.routes.js';

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

app.listen(NODO.puerto, () => {
  console.log(`${NODO.nombre} en http://localhost:${NODO.puerto}`);
});