// Limite de logins fallidos por IP,
// Solo cuentan las respuestas 401; un login correcto no consume intentos
const VENTANA_MS = 15 * 60 * 1000;

const fallidosPorIp = new Map();

function maximoIntentos() {
  return Number(process.env.LOGIN_MAX_INTENTOS) || 10;
}

export function limitarIntentosLogin(req, res, next) {
  const ahora = Date.now();
  const ip = req.ip || 'desconocida';

  // Limpieza para que el mapa no crezca sin limite con IPs que no regresan
  if (fallidosPorIp.size > 10000) {
    for (const [llave, valor] of fallidosPorIp) {
      if (valor.reinicio <= ahora) fallidosPorIp.delete(llave);
    }
  }
  let registro = fallidosPorIp.get(ip);

  if (registro && registro.reinicio <= ahora) {
    fallidosPorIp.delete(ip);
    registro = null;
  }

  if (registro && registro.total >= maximoIntentos()) {
    const segundos = Math.ceil((registro.reinicio - ahora) / 1000);
    res.set('Retry-After', String(segundos));
    console.log('[WARN] [AUTH] Login bloqueado por intentos fallidos desde ' + ip);
    return res.status(429).json({ ok: false, error: 'Demasiados intentos fallidos, intenta en ' + segundos + ' segundos' });
  }

  res.on('finish', () => {
    if (res.statusCode !== 401) return;
    const actual = fallidosPorIp.get(ip);
    if (actual && actual.reinicio > Date.now()) {
      actual.total++;
    } else {
      fallidosPorIp.set(ip, { total: 1, reinicio: Date.now() + VENTANA_MS });
    }
  });

  next();
}

// Para tests
export function reiniciarIntentos() {
  fallidosPorIp.clear();
}
