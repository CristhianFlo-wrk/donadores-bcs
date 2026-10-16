// Proveedor de notificaciones reales con Firebase 

let firebaseApp = null;

export async function inicializarFirebase() {
  if (firebaseApp) return firebaseApp;

  if (!process.env.FIREBASE_PROJECT_ID) {
    return null;
  }

  try {
    const admin = await import('firebase-admin');
    const opciones = { projectId: process.env.FIREBASE_PROJECT_ID };
    // En Render no hay credenciales por defecto: se pasa el JSON de la cuenta de servicio en una variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      opciones.credential = admin.default.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    }
    firebaseApp = admin.default.initializeApp(opciones);
    console.log('[NOTIFICACIONES] Firebase inicializado');
    return firebaseApp;
  } catch (error) {
    console.error('[WARN] Firebase no se pudo inicializar: ' + error.message);
    return null;
  }
}

// datos: pares string -> string que la app recibe junto al push (ej. id_notificacion)
export async function enviarPushReal(tokenDispositivo, titulo, cuerpo, datos = {}) {
  const app = await inicializarFirebase();
  if (!app) {
    return { ok: false, error: 'Firebase no configurado' };
  }

  try {
    const admin = await import('firebase-admin');
    const mensaje = {
      token: tokenDispositivo,
      notification: { title: titulo, body: cuerpo },
      data: datos
    };
    const result = await admin.default.messaging().send(mensaje);
    return { ok: true, canal: 'push', modo: 'real', messageId: result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}