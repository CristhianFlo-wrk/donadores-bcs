// Proveedor de notificaciones reales con Firebase 

let firebaseApp = null;

export async function inicializarFirebase() {
  if (firebaseApp) return firebaseApp;

  if (!process.env.FIREBASE_PROJECT_ID) {
    return null;
  }

  try {
    const admin = await import('firebase-admin');
    firebaseApp = admin.default.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    console.log('[FIREBASE] Inicializado correctamente');
    return firebaseApp;
  } catch (error) {
    console.log('[FIREBASE] No se pudo inicializar:', error.message);
    return null;
  }
}

export async function enviarPushReal(tokenDispositivo, titulo, cuerpo) {
  const app = await inicializarFirebase();
  if (!app) {
    return { ok: false, error: 'Firebase no configurado' };
  }

  try {
    const admin = await import('firebase-admin');
    const mensaje = {
      token: tokenDispositivo,
      notification: { title: titulo, body: cuerpo }
    };
    const result = await admin.default.messaging().send(mensaje);
    return { ok: true, canal: 'push', modo: 'real', messageId: result };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}