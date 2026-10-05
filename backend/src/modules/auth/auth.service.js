import jwt from 'jsonwebtoken';
import { hashPassword, verificarPassword, hashCURP, cifrar } from '../../utils/crypto.js';

//Registra un nuevo donante en la BD, recibe los datos del formulario y guarda la información
export async function registrarDonante(db, datos) {
  const {
    email,
    password,
    nombre_completo,
    curp,
    fecha_nacimiento,
    sexo,
    telefono,
    id_tipo_sangre,
    id_colonia,
    colonia_personalizada,
    latitud,
    longitud,
    id_nodo,
    peso_kg
  } = datos;

  // Validaciones básicas
  if (!email || !password || !nombre_completo || !curp || !id_tipo_sangre) {
    throw new Error('Faltan campos obligatorios');
  }

  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }

  const edad = calcularEdad(fecha_nacimiento);
  if (edad < 18 || edad > 65) {
    throw new Error('Debes tener entre 18 y 65 años para donar');
  }

  if (peso_kg && peso_kg < 50) {
    throw new Error('El peso mínimo para donar es 50 kg');
  }

  // Verificar email 
  const emailExistente = db.prepare(
    'SELECT id FROM usuarios WHERE email = ?'
  ).get(email);
  if (emailExistente) {
    throw new Error('El email ya está registrado');
  }

  // Verificar CURP único (comparando hashes)
  const curpHash = hashCURP(curp);
  const curpExistente = db.prepare(
    'SELECT id FROM donantes WHERE curp_hash = ?'
  ).get(curpHash);
  if (curpExistente) {
    throw new Error('El CURP ya está registrado');
  }

  // Validar colonia
  if (id_colonia && colonia_personalizada) {
    throw new Error('Debe elegir una colonia del catálogo o escribir una personalizada, no ambas');
  }
  if (!id_colonia && !colonia_personalizada) {
    throw new Error('Debe elegir una colonia o escribir una personalizada');
  }

  // Cifrar datos sensibles
  const passwordHash = await hashPassword(password);
  const nombreCifrado = cifrar(nombre_completo);
  const telefonoCifrado = telefono ? cifrar(telefono) : null;

  // Insertar usuario
  const resultUsuario = db.prepare(`
    INSERT INTO usuarios (email, password_hash, rol)
    VALUES (?, ?, 'donante')
  `).run(email, passwordHash);

  const idUsuario = resultUsuario.lastInsertRowid;

  // Insertar donante
  const resultDonante = db.prepare(`
    INSERT INTO donantes (
      id_usuario, nombre_cifrado, curp_hash, fecha_nacimiento, sexo,
      telefono_cifrado, id_tipo_sangre, id_colonia, colonia_personalizada,
      latitud, longitud, id_nodo, peso_kg
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    idUsuario,
    nombreCifrado,
    curpHash,
    fecha_nacimiento,
    sexo,
    telefonoCifrado,
    id_tipo_sangre,
    id_colonia || null,
    colonia_personalizada || null,
    latitud || null,
    longitud || null,
    id_nodo,
    peso_kg || null
  );

  return {
    id_usuario: idUsuario,
    id_donante: resultDonante.lastInsertRowid,
    email,
    rol: 'donante'
  };
}

/**
 * Login: verifica credenciales y devuelve JWT
 */
export async function login(db, email, password) {
  const usuario = db.prepare(`
    SELECT id, email, password_hash, rol, activo
    FROM usuarios
    WHERE email = ?
  `).get(email);

  if (!usuario) {
    throw new Error('Credenciales inválidas');
  }

  if (!usuario.activo) {
    throw new Error('Usuario desactivado');
  }

  const passwordValida = await verificarPassword(password, usuario.password_hash);
  if (!passwordValida) {
    throw new Error('Credenciales inválidas');
  }

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol
    }
  };
}


function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return 0;
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}