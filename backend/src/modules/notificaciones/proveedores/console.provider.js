// Proveedor de notificaciones simulado por consola

export async function enviarPushSimulado(destinatario, mensaje) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[NOTIFICACIONES] Push simulado para ${destinatario}: ${mensaje}`);
  }
  return { ok: true, canal: 'push', modo: 'simulado' };
}

export async function enviarSmsSimulado(telefono, mensaje) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[NOTIFICACIONES] SMS simulado para ${telefono}: ${mensaje}`);
  }
  return { ok: true, canal: 'sms', modo: 'simulado' };
}
