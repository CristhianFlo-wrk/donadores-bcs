export const NODOS = {
  norte: {
    id: 'norte',
    nombre: 'Nodo Norte',
    municipios: ['Mulegé'],
    puerto: 3001,
    url: 'http://localhost:3001'
  },
  centro: {
    id: 'centro',
    nombre: 'Nodo Centro',
    municipios: ['Comondú', 'Loreto'],
    puerto: 3002,
    url: 'http://localhost:3002'
  },
  sur: {
    id: 'sur',
    nombre: 'Nodo Sur',
    municipios: ['La Paz', 'Los Cabos'],
    puerto: 3003,
    url: 'http://localhost:3003'
  }
};

export function getNodo(id) {
  return NODOS[id] || null;
}

export function getNodosActivos() {
  return Object.values(NODOS);
}

export function getOtrosNodos(idOrigen) {
  return getNodosActivos().filter(n => n.id !== idOrigen);
}