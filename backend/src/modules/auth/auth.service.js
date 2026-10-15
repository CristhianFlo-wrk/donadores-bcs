import jwt from 'jsonwebtoken';
import { query, transaccion } from '../../config/database.js';
import { hashPassword, verificarPassword, hashCURP, normalizarCURP, cifrar } from '../../utils/crypto.js';
import { errorValidacion, ErrorHttp } from '../../utils/errores.js';
import { resolverColonia } from '../ubicaciones/ubicaciones.service.js';
import { validarPeso, validarCoordenadas } from '../donantes/donantes.validaciones.js';
import { registrarLog } from '../auditoria/auditoria.service.js';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/;
const SEXOS = ['M', 'F', 'otro'];

// Validaciones que no requieren base de datos
function validarDatosRegistro(datos) {
  const {
    email, password, nombre_completo: nombreCompleto, curp, fecha_nacimiento: fechaNacimiento,
    sexo, id_tipo_sangre: idTipoSangre, id_colonia: idColonia, peso_kg: pesoKg
  } = datos;

  if (!email || !password || !nombreCompleto || !curp || !fechaNacimiento || !idTipoSangre || !idColonia) {
    throw errorValidacion('Faltan campos obligatorios: email, password, nombre_completo, curp, fecha_nacimiento, id_tipo_sangre, id_colonia');
  }

  if (!REGEX_EMAIL.test(email)) {
    throw errorValidacion('Email invalido');
  }

  if (String(password).length < 8) {
    throw errorValidacion('La contrasena debe tener al menos 8 caracteres');
  }

  if (!REGEX_CURP.test(normalizarCURP(curp))) {
    throw errorValidacion('CURP con formato invalido');
  }

  const edad = calcularEdad(fechaNacimiento);
  if (edad === null) {
    throw errorValidacion('fecha_nacimiento invalida, usar formato YYYY-MM-DD');
  }
  if (edad < 18 || edad > 65) {
    throw errorValidacion('Debes tener entre 18 y 65 anos para donar');
  }

  if (sexo !== undefined && sexo !== null && !SEXOS.includes(sexo)) {
    throw errorValidacion('sexo debe ser M, F u otro');
  }

  validarPeso(pesoKg);
  validarCoordenadas(datos.latitud, datos.longitud);
}

// Registra un donante: crea usuario y donante en una sola transaccion
export async function registrarDonante(datos, contexto = {}) {
  validarDatosRegistro(datos);

  const email = String(datos.email).trim().toLowerCase();
  const curpHash = hashCURP(datos.curp);

  try {
    return await transaccion(async (client) => {
      const emailExistente = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
      if (emailExistente.rows.length > 0) {
        throw errorValidacion('El email ya esta registrado');
      }

      const curpExistente = await client.query('SELECT id FROM donantes WHERE curp_hash = $1', [curpHash]);
      if (curpExistente.rows.length > 0) {
        throw errorValidacion('El CURP ya esta registrado');
      }

      const tipoSangre = await client.query('SELECT id FROM tipos_sangre WHERE id = $1', [datos.id_tipo_sangre]);
      if (tipoSangre.rows.length === 0) {
        throw errorValidacion('Tipo de sangre invalido');
      }

      const colonia = await resolverColonia(datos.id_colonia, datos.colonia_personalizada, client);

      const passwordHash = await hashPassword(datos.password);

      const usuario = await client.query(`
        INSERT INTO usuarios (email, password_hash, rol)
        VALUES ($1, $2, 'donante')
        RETURNING id
      `, [email, passwordHash]);
      const idUsuario = usuario.rows[0].id;

      const donante = await client.query(`
        INSERT INTO donantes (
          id_usuario, nombre_cifrado, curp_hash, fecha_nacimiento, sexo,
          telefono_cifrado, id_tipo_sangre, id_colonia, colonia_personalizada,
          latitud, longitud, region, peso_kg
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        idUsuario,
        cifrar(String(datos.nombre_completo).trim()),
        curpHash,
        datos.fecha_nacimiento,
        datos.sexo || null,
        cifrar(datos.telefono),
        datos.id_tipo_sangre,
        colonia.idColonia,
        colonia.coloniaPersonalizada,
        datos.latitud ?? null,
        datos.longitud ?? null,
        colonia.region,
        datos.peso_kg ?? null
      ]);

      await registrarLog(client, {
        idUsuario,
        accion: 'REGISTRO_DONANTE',
        detalles: { id_donante: donante.rows[0].id, region: colonia.region },
        ipOrigen: contexto.ip
      });

      console.log('[AUTH] Donante registrado, id_usuario=' + idUsuario);

      return {
        id_usuario: idUsuario,
        id_donante: donante.rows[0].id,
        email,
        rol: 'donante',
        region: colonia.region
      };
    });
  } catch (error) {
    // 23505 = unique_violation: dos registros simultaneos con el mismo email o CURP
    if (error.code === '23505') {
      throw errorValidacion('El email o CURP ya esta registrado');
    }
    throw error;
  }
}

// Verifica credenciales y devuelve JWT
export async function login(email, password, contexto = {}) {
  const { rows } = await query(`
    SELECT id, email, password_hash, rol, id_hospital, activo
    FROM usuarios
    WHERE email = $1
  `, [String(email).trim().toLowerCase()]);

  const usuario = rows[0];

  if (!usuario || !(await verificarPassword(String(password), usuario.password_hash))) {
    await registrarLog(null, {
      idUsuario: usuario ? usuario.id : null,
      accion: 'LOGIN_FALLIDO',
      detalles: { email: String(email).trim().toLowerCase() },
      ipOrigen: contexto.ip
    });
    throw new ErrorHttp(401, 'Credenciales invalidas');
  }

  if (!usuario.activo) {
    await registrarLog(null, { idUsuario: usuario.id, accion: 'LOGIN_BLOQUEADO', ipOrigen: contexto.ip });
    throw new ErrorHttp(403, 'Usuario desactivado');
  }

  const datosToken = { id: usuario.id, email: usuario.email, rol: usuario.rol };
  if (usuario.rol === 'hospital') {
    datosToken.id_hospital = usuario.id_hospital;
  }

  await registrarLog(null, { idUsuario: usuario.id, accion: 'LOGIN_EXITOSO', ipOrigen: contexto.ip });

  const token = jwt.sign(datosToken, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });

  return { token, usuario: datosToken };
}

// Regresa null si la fecha no es valida
function calcularEdad(fechaNacimiento) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaNacimiento))) return null;
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  if (Number.isNaN(nacimiento.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}
