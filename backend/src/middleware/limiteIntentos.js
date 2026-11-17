// Limitadores por IP en memoria. Se reinician con el servidor; con una sola instancia basta
const registros = [];


export function enmascararIp(ip) {
  const texto = String(ip || '').replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(texto)) return texto.split('.').slice(0, 2).join('.') + '.x.x';
  if (texto.includes(':')) return texto.split(':').slice(0, 2).map((grupo) => grupo || '0').join(':') + ':x';
  return 'desconocida';
}

// cuenta: decide por status si la respuesta consume un intento
export function crearLimitador({ ventanaMs, maximo, cuenta = () => true, mensaje, etiqueta }) {
  const porIp = new Map();
  registros.push(porIp);

  return (req, res, next) => {
    const ahora = Date.now();
    const ip = req.ip || 'desconocida';

    // Limpieza para que el mapa no crezca sin limite con IPs que no regresan
    if (porIp.size > 10000) {
      for (const [llave, valor] of porIp) {
        if (valor.reinicio <= ahora) porIp.delete(llave);
      }
    }
    let registro = porIp.get(ip);

    if (registro && registro.reinicio <= ahora) {
      porIp.delete(ip);
      registro = null;
    }

    if (registro && registro.total >= maximo()) {
      const segundos = Math.ceil((registro.reinicio - ahora) / 1000);
      res.set('Retry-After', String(segundos));
      console.log(etiqueta + ' desde ' + enmascararIp(req.ip));
      return res.status(429).json({ ok: false, error: mensaje + ', intenta en ' + segundos + ' segundos' });
    }

    res.on('finish', () => {
      if (!cuenta(res.statusCode)) return;
      const actual = porIp.get(ip);
      if (actual && actual.reinicio > Date.now()) {
        actual.total++;
      } else {
        porIp.set(ip, { total: 1, reinicio: Date.now() + ventanaMs });
      }
    });

    next();
  };
}

// Solo cuentan las respuestas 401; un login correcto no consume intentos
export const limitarIntentosLogin = crearLimitador({
  ventanaMs: 15 * 60 * 1000,
  maximo: () => Number(process.env.LOGIN_MAX_INTENTOS) || 10,
  cuenta: (status) => status === 401,
  mensaje: 'Demasiados intentos fallidos',
  etiqueta: '[WARN] [AUTH] Login bloqueado por intentos fallidos'
});

// Solo cuentan los registros exitosos
export const limitarRegistro = crearLimitador({
  ventanaMs: 60 * 60 * 1000,
  maximo: () => Number(process.env.LIMITE_REGISTRO_POR_HORA) || 10,
  cuenta: (status) => status === 201,
  mensaje: 'Demasiadas peticiones',
  etiqueta: '[WARN] [AUTH] Registro bloqueado por limite'
});

export const limitarSolicitudesCiudadanas = crearLimitador({
  ventanaMs: 60 * 60 * 1000,
  maximo: () => Number(process.env.LIMITE_SOLICITUDES_POR_HORA) || 5,
  cuenta: (status) => status === 201,
  mensaje: 'Demasiadas peticiones',
  etiqueta: '[WARN] [SOLICITUDES] Solicitud ciudadana bloqueada por limite'
});

export const limitarGeneral = crearLimitador({
  ventanaMs: 60 * 1000,
  maximo: () => Number(process.env.LIMITE_GENERAL_POR_MINUTO) || 300,
  mensaje: 'Demasiadas peticiones',
  etiqueta: '[WARN] [SERVER] Peticion bloqueada por limite general'
});

// Para tests
export function reiniciarIntentos() {
  registros.forEach((porIp) => porIp.clear());
}
