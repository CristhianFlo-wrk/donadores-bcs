export function getHospitales(req, res) {
  try {
    const hospitales = req.db.prepare(`
      SELECT id, nombre, institucion, id_nodo, direccion, telefono, latitud, longitud
      FROM hospitales
      WHERE activo = 1
      ORDER BY id_nodo, nombre
    `).all();

    res.json({ ok: true, total: hospitales.length, hospitales });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function getHospitalPorId(req, res) {
  try {
    const hospital = req.db.prepare(`
      SELECT id, nombre, institucion, id_nodo, direccion, telefono, latitud, longitud
      FROM hospitales
      WHERE id = ? AND activo = 1
    `).get(req.params.id);

    if (!hospital) {
      return res.status(404).json({ ok: false, error: 'Hospital no encontrado' });
    }

    res.json({ ok: true, hospital });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}