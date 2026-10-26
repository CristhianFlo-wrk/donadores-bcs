import jwt from 'jsonwebtoken';
import { query, transaccion } from '../../config/database.js';
import { hashPassword, verificarPassword, hashCURP, normalizarCURP, cifrar } from '../../utils/crypto.js';
import { errorValidacion, ErrorHttp, parsearId } from '../../utils/errores.js';
import { resolverColonia } from '../ubicaciones/ubicaciones.service.js';
import { validarPeso, validarCoordenadas } from '../donantes/donantes.validaciones.js';
import { registrarLog } from '../auditoria/auditoria.service.js';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/;
const SEXOS = ['M', 'F', 'otro'];
const MENSAJE_DUPLICADO = 'El email o CURP ya está registrado';

// Validaciones que no requieren base de datos
function validarDatosRegistro(datos) {
  const {
    email, password, nombre_completo: nombreCompleto, curp, fecha_nacimiento: fechaNacimiento,
    sexo, id_tipo_sangre: idTipoSangre, id_colonia: idColonia, peso_kg: pesoKg
  } = datos;

  if (!email || !password || !nombreCompleto || !curp || !fechaNacimiento || !idTipoSangre || !idColonia) {
    throw errorValidacion('Faltan campos obligatorios: email, password, nombre_completo, curp, fecha_nacimiento, id_tipo_sangre, id_colonia');
  }

  parsearId(idTipoSangre, 'id_tipo_sangre');
  parsearId(idColonia, 'id_colonia');

  if (!REGEX_EMAIL.test(email)) {
    throw errorValidacion('Email inválido');
  }

  if (String(password).length < 8) {
    throw errorValidacion('La contraseña debe tener al menos 8 caracteres');
  }

  if (!REGEX_CURP.test(normalizarCURP(curp))) {
    throw errorValidacion('CURP con formato inválido');
  }

  const edad = calcularEdad(fechaNacimiento);
  if (edad === null) {
    throw errorValidacion('fecha_nacimiento inválida, usar formato YYYY-MM-DD');
  }
  if (edad < 18 || edad > 65) {
    throw errorValidacion('Debes tener entre 18 y 65 años para donar');
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
      
      const existente = await client.query(`
        SELECT 1 FROM usuarios WHERE email = $1
        UNION ALL
        SELECT 1 FROM donantes WHERE curp_hash = $2
      `, [email, curpHash]);
      if (existente.rows.length > 0) {
        throw errorValidacion(MENSAJE_DUPLICADO);
      }

      const tipoSangre = await client.query('SELECT id FROM tipos_sangre WHERE id = $1', [datos.id_tipo_sangre]);
      if (tipoSangre.rows.length === 0) {
        throw errorValidacion('Tipo de sangre inválido');
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
      throw errorValidacion(MENSAJE_DUPLICADO);
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
    throw new ErrorHttp(401, 'Credenciales inválidas');
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

const ROLES_ADMINISTRADOS = ['hospital', 'admin'];

// Solo admin: crea cuentas de hospital o admin (los donantes se registran solos)
export async function crearUsuario(datos, contexto = {}) {
  const { email, password, rol } = datos;

  if (!email || !password || !rol) {
    throw errorValidacion('Faltan campos obligatorios: email, password, rol');
  }
  if (!REGEX_EMAIL.test(email)) {
    throw errorValidacion('Email inválido');
  }
  if (String(password).length < 8) {
    throw errorValidacion('La contraseña debe tener al menos 8 caracteres');
  }
  if (!ROLES_ADMINISTRADOS.includes(rol)) {
    throw errorValidacion('rol debe ser "hospital" o "admin"');
  }

  let idHospital = null;
  if (rol === 'hospital') {
    if (datos.id_hospital === undefined || datos.id_hospital === null) {
      throw errorValidacion('id_hospital es obligatorio para usuarios hospital');
    }
    idHospital = parsearId(datos.id_hospital, 'id_hospital');
  } else if (datos.id_hospital !== undefined && datos.id_hospital !== null) {
    throw errorValidacion('Un usuario admin no lleva id_hospital');
  }

  const emailNormalizado = String(email).trim().toLowerCase();

  try {
    return await transaccion(async (client) => {
      if (idHospital) {
        const hospital = await client.query('SELECT id FROM hospitales WHERE id = $1 AND activo = TRUE', [idHospital]);
        if (hospital.rows.length === 0) {
          throw errorValidacion('Hospital no encontrado o inactivo');
        }
      }

      const { rows } = await client.query(`
        INSERT INTO usuarios (email, password_hash, rol, id_hospital)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, rol, id_hospital, activo, created_at
      `, [emailNormalizado, await hashPassword(String(password)), rol, idHospital]);

      await registrarLog(client, {
        idUsuario: contexto.idUsuario,
        accion: 'USUARIO_CREADO',
        detalles: { id_usuario: rows[0].id, rol, id_hospital: idHospital },
        ipOrigen: contexto.ip
      });

      console.log('[AUTH] Usuario ' + rol + ' creado, id_usuario=' + rows[0].id);
      return rows[0];
    });
  } catch (error) {
    if (error.code === '23505') {
      throw errorValidacion('El email ya está registrado');
    }
    throw error;
  }
}

export async function listarUsuarios({ rol = null, limite = 50 } = {}) {
  if (rol && !['donante', ...ROLES_ADMINISTRADOS].includes(rol)) {
    throw errorValidacion('rol debe ser donante, hospital o admin');
  }

  const valores = [];
  let sql = 'SELECT id, email, rol, id_hospital, activo, created_at FROM usuarios WHERE TRUE';
  if (rol) {
    valores.push(rol);
    sql += ` AND rol = $${valores.length}`;
  }
  valores.push(limite);
  sql += ` ORDER BY id ASC LIMIT $${valores.length}`;

  const { rows } = await query(sql, valores);
  return rows;
}

// Desactivar corta el acceso de inmediato: verificarToken revisa activo en cada peticion
export async function cambiarActivoUsuario(idUsuario, activo, contexto = {}) {
  if (typeof activo !== 'boolean') {
    throw errorValidacion('Campo "activo" debe ser boolean');
  }
  if (idUsuario === contexto.idUsuario) {
    throw errorValidacion('No puedes cambiar el estado de tu propia cuenta');
  }

  return transaccion(async (client) => {
    const { rows } = await client.query(`
      UPDATE usuarios SET activo = $1 WHERE id = $2
      RETURNING id, email, rol, id_hospital, activo
    `, [activo, idUsuario]);

    if (rows.length === 0) {
      throw new ErrorHttp(404, 'Usuario no encontrado');
    }

    await registrarLog(client, {
      idUsuario: contexto.idUsuario,
      accion: activo ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
      detalles: { id_usuario: idUsuario },
      ipOrigen: contexto.ip
    });

    return rows[0];
  });
}

// Regresa null si la fecha no es valida
function calcularEdad(fechaNacimiento) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaNacimiento))) return null;
  const [anio, mes, dia] = String(fechaNacimiento).split('-').map(Number);
  const nacimiento = new Date(anio, mes - 1, dia);
  // Date corrige fechas inexistentes (2000-02-31 -> 2000-03-02); se rechazan comparando las partes
  if (nacimiento.getFullYear() !== anio || nacimiento.getMonth() !== mes - 1 || nacimiento.getDate() !== dia) {
    return null;
  }

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}
