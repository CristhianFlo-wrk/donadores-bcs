import { query } from '../../config/database.js';
import { DIAS_ENTRE_DONACIONES } from '../donantes/donantes.service.js';

// Agrega condicion de hospital si se indica; los datos de donantes son agregados de todo el estado
function filtroHospital(columna, idHospital, valores) {
  if (!idHospital) return '';
  valores.push(idHospital);
  return ` AND ${columna} = $${valores.length}`;
}

async function resumenDonantes() {
  const { rows } = await query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE d.disponible) AS disponibles,
           COUNT(*) FILTER (
             WHERE d.disponible
               AND (d.ultima_donacion IS NULL OR d.ultima_donacion <= NOW() - INTERVAL '${DIAS_ENTRE_DONACIONES} days')
           ) AS aptos
    FROM donantes d
    JOIN usuarios u ON d.id_usuario = u.id
    WHERE u.activo = TRUE
  `);
  return rows[0];
}

// Incluye los 8 tipos aunque no tengan donantes, para que la grafica siempre tenga las mismas barras
async function donantesPorGrupo() {
  const { rows } = await query(`
    SELECT ts.codigo AS tipo_sangre, COUNT(d.id) AS total
    FROM tipos_sangre ts
    LEFT JOIN (
      donantes d JOIN usuarios u ON d.id_usuario = u.id AND u.activo = TRUE
    ) ON d.id_tipo_sangre = ts.id
    GROUP BY ts.id, ts.codigo
    ORDER BY ts.id
  `);

  const total = rows.reduce((suma, fila) => suma + fila.total, 0);
  return rows.map((fila) => ({
    ...fila,
    porcentaje: total === 0 ? 0 : Math.round((fila.total * 1000) / total) / 10
  }));
}

async function donantesPorRegion() {
  const { rows } = await query(`
    SELECT d.region, COUNT(*) AS total
    FROM donantes d
    JOIN usuarios u ON d.id_usuario = u.id
    WHERE u.activo = TRUE
    GROUP BY d.region
    ORDER BY d.region
  `);
  return rows;
}

async function resumenSolicitudes(idHospital) {
  const valores = [];
  const { rows } = await query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE estado = 'activa') AS activas,
           COUNT(*) FILTER (WHERE estado = 'activa' AND urgencia = 'critica') AS criticas_activas,
           COUNT(*) FILTER (WHERE estado = 'completada') AS completadas,
           COUNT(*) FILTER (WHERE estado = 'cancelada') AS canceladas
    FROM solicitudes
    WHERE TRUE ${filtroHospital('id_hospital', idHospital, valores)}
  `, valores);
  return rows[0];
}

async function solicitudesAtendidas(idHospital, limite) {
  const valores = [];
  const filtro = filtroHospital('s.id_hospital', idHospital, valores);
  valores.push(limite);
  const { rows } = await query(`
    SELECT s.id, s.urgencia, ts.codigo AS tipo_sangre, h.nombre AS hospital_nombre,
           s.fecha_solicitud, s.fecha_cierre,
           COUNT(n.id) AS total_notificados,
           COUNT(n.id) FILTER (WHERE n.estado = 'donada') AS donaciones
    FROM solicitudes s
    JOIN tipos_sangre ts ON s.id_tipo_sangre = ts.id
    JOIN hospitales h ON s.id_hospital = h.id
    LEFT JOIN notificaciones n ON n.id_solicitud = s.id
    WHERE s.estado = 'completada' ${filtro}
    GROUP BY s.id, ts.codigo, h.nombre
    ORDER BY s.fecha_cierre DESC
    LIMIT $${valores.length}
  `, valores);
  return rows;
}

async function totalDonaciones(idHospital) {
  const valores = [];
  const { rows } = await query(`
    SELECT COUNT(*) AS total
    FROM historial_donaciones
    WHERE TRUE ${filtroHospital('id_hospital', idHospital, valores)}
  `, valores);
  return rows[0].total;
}

// idHospital null = todo el sistema (admin)
export async function obtenerDashboard({ idHospital = null, limite = 10 } = {}) {
  const [donantes, porGrupo, porRegion, solicitudes, atendidas, donaciones] = await Promise.all([
    resumenDonantes(),
    donantesPorGrupo(),
    donantesPorRegion(),
    resumenSolicitudes(idHospital),
    solicitudesAtendidas(idHospital, limite),
    totalDonaciones(idHospital)
  ]);

  return {
    id_hospital: idHospital,
    donantes: { ...donantes, por_grupo_sanguineo: porGrupo, por_region: porRegion },
    solicitudes,
    donaciones_registradas: donaciones,
    solicitudes_atendidas: atendidas
  };
}
