import { obtenerDashboard } from './reportes.service.js';
import { parsearId, parsearLimite } from '../../utils/errores.js';

// Un hospital ve sus propias solicitudes; admin ve todo o filtra con ?id_hospital
export async function getDashboard(req, res) {
  const { rol, id_hospital: idHospitalToken } = req.usuario;
  let idHospital = null;

  if (rol === 'hospital') {
    idHospital = idHospitalToken;
  } else if (req.query.id_hospital) {
    idHospital = parsearId(req.query.id_hospital, 'id_hospital');
  }

  const dashboard = await obtenerDashboard({
    idHospital,
    limite: parsearLimite(req.query.limite, { defecto: 10, maximo: 50 })
  });
  res.json({ ok: true, dashboard });
}
