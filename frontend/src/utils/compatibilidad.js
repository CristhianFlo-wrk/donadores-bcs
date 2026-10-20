// Compatibilidad ABO y Rh de globulos rojos. Es la misma tabla que la base
// (compatibilidad_sanguinea) usa para decidir a quien avisar de una solicitud.
export const TIPOS_SANGRE = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export const PUEDE_DONAR_A = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+']
};

export function puedeRecibirDe(tipoReceptor) {
  return TIPOS_SANGRE.filter((tipoDonante) => PUEDE_DONAR_A[tipoDonante].includes(tipoReceptor));
}

export function esCompatible(tipoDonante, tipoReceptor) {
  return Boolean(PUEDE_DONAR_A[tipoDonante]?.includes(tipoReceptor));
}
