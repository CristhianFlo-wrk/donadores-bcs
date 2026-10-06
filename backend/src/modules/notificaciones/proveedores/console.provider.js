// Proveedor de notificaciones simulado por consola

export async function enviarPushSimulado(destinatario, mensaje) {
  console.log(`[PUSH-SIM] Para: ${destinatario} | Mensaje: ${mensaje}`);
  return { ok: true, canal: 'push', modo: 'simulado' };
}

export async function enviarSmsSimulado(telefono, mensaje) {
  console.log(`[SMS-SIM] Para: ${telefono} | Mensaje: ${mensaje}`);
  return { ok: true, canal: 'sms', modo: 'simulado' };
}