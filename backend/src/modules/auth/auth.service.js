import jwt from 'jsonwebtoken';
import { query, transaccion } from '../../config/database.js';
import { hashPassword, verificarPassword, hashCURP, normalizarCURP, cifrar } from '../../utils/crypto.js';
import { errorValidacion, ErrorHttp } from '../../utils/errores.js';

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/;
const SEXOS = ['M', 'F', 'otro'];
const NOMBRE_COLONIA_OTRA = 'Otra';

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

  if (pesoKg !== undefined && pesoKg !== null && !(Number(pesoKg) >= 50)) {
    throw errorValidacion('El peso minimo para donar es 50 kg');
  }
}

// Registra un donante: crea usuario y donante en una sola transaccion
export async function registrarDonante(datos) {
  validarDatosRegistro(datos);

  const email = String(datos.email).trim().toLowerCase();
  const curpHash = hashCURP(datos.curp);
  const coloniaPersonalizada = datos.colonia_personalizada ? String(datos.colonia_personalizada).trim() : null;

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

      // La region del donante se deriva de colonia -> municipio
      const colonia = await client.query(`
        SELECT c.id, c.nombre, m.region
        FROM colonias c
        JOIN municipios m ON c.id_municipio = m.id
        WHERE c.id = $1 AND c.activo = TRUE
      `, [datos.id_colonia]);
      if (colonia.rows.length === 0) {
        throw errorValidacion('Colonia no encontrada');
      }

      // colonia_personalizada solo se acepta cuando se elige la colonia "Otra" del municipio
      const esOtra = colonia.rows[0].nombre === NOMBRE_COLONIA_OTRA;
      if (esOtra && !coloniaPersonalizada) {
        throw errorValidacion('Si eliges la colonia "Otra" debes escribir colonia_personalizada');
      }
      if (!esOtra && coloniaPersonalizada) {
        throw errorValidacion('colonia_personalizada solo aplica cuando eliges la colonia "Otra"');
      }

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
        datos.id_colonia,
        esOtra ? coloniaPersonalizada : null,
        datos.latitud ?? null,
        datos.longitud ?? null,
        colonia.rows[0].region,
        datos.peso_kg ?? null
      ]);

      console.log('[AUTH] Donante registrado, id_usuario=' + idUsuario);

      return {
        id_usuario: idUsuario,
        id_donante: donante.rows[0].id,
        email,
        rol: 'donante',
        region: colonia.rows[0].region
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
export async function login(email, password) {
  const { rows } = await query(`
    SELECT id, email, password_hash, rol, id_hospital, activo
    FROM usuarios
    WHERE email = $1
  `, [String(email).trim().toLowerCase()]);

  const usuario = rows[0];

  if (!usuario || !(await verificarPassword(String(password), usuario.password_hash))) {
    throw new ErrorHttp(401, 'Credenciales invalidas');
  }

  if (!usuario.activo) {
    throw new ErrorHttp(403, 'Usuario desactivado');
  }

  const datosToken = { id: usuario.id, email: usuario.email, rol: usuario.rol };
  if (usuario.rol === 'hospital') {
    datosToken.id_hospital = usuario.id_hospital;
  }

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
