
//Controlador de ubicaciones: municipios y colonias


export function getMunicipios(req, res) {
  try {
    const municipios = req.db.prepare(`
      SELECT id, nombre, id_nodo, latitud, longitud
      FROM municipios
      WHERE activo = 1
      ORDER BY nombre ASC
    `).all();

    res.json({ ok: true, total: municipios.length, municipios });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function getColoniasPorMunicipio(req, res) {
  try {
    const { idMunicipio } = req.params;

    const municipio = req.db.prepare(`
      SELECT id, nombre FROM municipios WHERE id = ?
    `).get(idMunicipio);

    if (!municipio) {
      return res.status(404).json({ ok: false, error: 'Municipio no encontrado' });
    }

    const colonias = req.db.prepare(`
      SELECT id, nombre, codigo_postal, latitud, longitud
      FROM colonias
      WHERE id_municipio = ? AND activo = 1
      ORDER BY nombre ASC
    `).all(idMunicipio);

    res.json({
      ok: true,
      municipio: municipio.nombre,
      total: colonias.length,
      colonias
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export function getTiposSangre(req, res) {
  try {
    const tipos = req.db.prepare(`
      SELECT id, codigo, grupo, rh, descripcion,
             es_donante_universal, es_receptor_universal
      FROM tipos_sangre
      ORDER BY id ASC
    `).all();

    res.json({ ok: true, total: tipos.length, tipos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}