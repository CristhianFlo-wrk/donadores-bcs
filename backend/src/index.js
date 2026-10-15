import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { probarConexion } from './config/database.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    servidor: 'OK',
    timestamp: new Date().toISOString()
  });
});

async function iniciar() {
  const conectado = await probarConexion();
  if (!conectado) {
    console.error('[ERROR] No se puede iniciar el servidor sin conexion a la base de datos');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('[SERVER] Servidor corriendo en puerto ' + PORT);
  });
}

iniciar();