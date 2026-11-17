// Proveedor de notificaciones simulado por consola

export async function enviarPushSimulado(destinatario, mensaje) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[NOTIFICACIONES] Push simulado para ${destinatario}: ${mensaje}`);
  }
  return { ok: true, canal: 'push', modo: 'simulado' };
}
