import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import axios from 'axios';
import { getNodosActivos } from './config/nodos.js';

const app = express();
const PORT = 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  const nodos = getNodosActivos();
  const estados = await Promise.all(
    nodos.map(async (n) => {
      try {
        await axios.get(`${n.url}/api/health`, { timeout: 2000 });
        return { id: n.id, nombre: n.nombre, status: 'OK' };
      } catch {
        return { id: n.id, nombre: n.nombre, status: 'DOWN' };
      }
    })
  );
  res.json({ servidorCentral: 'OK', nodos: estados });
});

app.get('/api/blockchain/estado-global', async (req, res) => {
  const nodos = getNodosActivos();
  const estados = await Promise.all(
    nodos.map(async (n) => {
      try {
        const r = await axios.get(`${n.url}/api/blockchain/estado`, { timeout: 2000 });
        return { nodo: n.id, ...r.data };
      } catch {
        return { nodo: n.id, status: 'DOWN' };
      }
    })
  );
  res.json({ nodos: estados, timestamp: new Date().toISOString() });
});

app.post('/api/blockchain/sincronizar-todos', async (req, res) => {
  const nodos = getNodosActivos();
  const resultados = [];
  for (const origen of nodos) {
    for (const destino of nodos) {
      if (origen.id === destino.id) continue;
      try {
        const r = await axios.post(`${origen.url}/api/blockchain/sincronizar`,
          { nodoDestino: destino.id }, { timeout: 5000 });
        resultados.push({ origen: origen.id, destino: destino.id, ...r.data });
      } catch (error) {
        resultados.push({ origen: origen.id, destino: destino.id, error: error.message });
      }
    }
  }
  res.json({ ok: true, resultados });
});

app.listen(PORT, () => {
  console.log(`Servidor central en http://localhost:${PORT}`);
  console.log(`Nodos: ${getNodosActivos().map(n => n.id).join(', ')}`);
});