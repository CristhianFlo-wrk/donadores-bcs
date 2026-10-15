export const REGIONES = {
  norte: {
    id: 'norte',
    nombre: 'Region Norte',
    municipios: ['Mulege']
  },
  centro: {
    id: 'centro',
    nombre: 'Region Centro',
    municipios: ['Comondu', 'Loreto']
  },
  sur: {
    id: 'sur',
    nombre: 'Region Sur',
    municipios: ['La Paz', 'Los Cabos']
  }
};

export function getRegion(id) {
  return REGIONES[id] || null;
}

export function getRegiones() {
  return Object.values(REGIONES);
}




