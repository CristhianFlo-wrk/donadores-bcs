
-- SISTEMA DE DONADORES DE SANGRE BCS esquema PostgreSQL de PRODUCCION
-- No borra nada: IF NOT EXISTS permite correrlo sobre una base con datos

CREATE TABLE IF NOT EXISTS tipos_sangre (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(3) UNIQUE NOT NULL,
    grupo VARCHAR(2) NOT NULL,
    rh VARCHAR(1) NOT NULL CHECK (rh IN ('+', '-')),
    descripcion VARCHAR(100),
    es_donante_universal BOOLEAN DEFAULT FALSE,
    es_receptor_universal BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS compatibilidad_sanguinea (
    id_donante INTEGER NOT NULL REFERENCES tipos_sangre(id),
    id_receptor INTEGER NOT NULL REFERENCES tipos_sangre(id),
    PRIMARY KEY (id_donante, id_receptor)
);

CREATE TABLE IF NOT EXISTS municipios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    region VARCHAR(20) CHECK (region IN ('norte', 'centro', 'sur')) NOT NULL,
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS colonias (
    id SERIAL PRIMARY KEY,
    id_municipio INTEGER NOT NULL REFERENCES municipios(id),
    nombre VARCHAR(150) NOT NULL,
    codigo_postal VARCHAR(10),
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE(id_municipio, nombre)
);

CREATE TABLE IF NOT EXISTS hospitales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    institucion VARCHAR(20) CHECK (institucion IN ('IMSS', 'ISSSTE', 'SSBCS', 'otro')),
    region VARCHAR(20) CHECK (region IN ('norte', 'centro', 'sur')),
    direccion TEXT,
    telefono VARCHAR(20),
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) CHECK (rol IN ('donante', 'hospital', 'admin')) NOT NULL,
    id_hospital INTEGER REFERENCES hospitales(id),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CHECK ((rol = 'hospital') = (id_hospital IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS donantes (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER UNIQUE NOT NULL REFERENCES usuarios(id),
    nombre_cifrado TEXT NOT NULL,
    curp_hash VARCHAR(64) UNIQUE NOT NULL,
    fecha_nacimiento DATE,
    sexo VARCHAR(10) CHECK (sexo IN ('M', 'F', 'otro')),
    telefono_cifrado TEXT,
    id_tipo_sangre INTEGER NOT NULL REFERENCES tipos_sangre(id),
    id_colonia INTEGER REFERENCES colonias(id),
    colonia_personalizada VARCHAR(150),
    latitud NUMERIC(9,6),
    longitud NUMERIC(9,6),
    region VARCHAR(20) CHECK (region IN ('norte', 'centro', 'sur')),
    disponible BOOLEAN DEFAULT TRUE,
    peso_kg NUMERIC(5,2) CHECK (peso_kg >= 50),
    ha_donado_antes BOOLEAN DEFAULT FALSE,
    ultima_donacion TIMESTAMPTZ,
    fcm_token TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id SERIAL PRIMARY KEY,
    id_hospital INTEGER NOT NULL REFERENCES hospitales(id),
    id_tipo_sangre INTEGER NOT NULL REFERENCES tipos_sangre(id),
    urgencia VARCHAR(20) CHECK (urgencia IN ('critica', 'urgente')) NOT NULL,
    estado VARCHAR(20) CHECK (estado IN ('activa', 'completada', 'cancelada')) DEFAULT 'activa',
    unidades_requeridas INTEGER NOT NULL DEFAULT 1 CHECK (unidades_requeridas BETWEEN 1 AND 20),
    descripcion TEXT,
    fecha_solicitud TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    id_solicitud INTEGER NOT NULL REFERENCES solicitudes(id),
    id_donante INTEGER NOT NULL REFERENCES donantes(id),
    canal VARCHAR(20) CHECK (canal IN ('push', 'sms')) NOT NULL,
    estado VARCHAR(20) CHECK (estado IN ('enviada', 'confirmada', 'rechazada', 'donada')) DEFAULT 'enviada',
    fecha_envio TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta TIMESTAMPTZ,
    UNIQUE (id_solicitud, id_donante)
);

CREATE TABLE IF NOT EXISTS historial_donaciones (
    id SERIAL PRIMARY KEY,
    id_donante_hash VARCHAR(64) NOT NULL,
    fecha_donacion TIMESTAMPTZ NOT NULL,
    grupo_sanguineo VARCHAR(3) NOT NULL,
    id_hospital INTEGER NOT NULL REFERENCES hospitales(id),
    region VARCHAR(20) CHECK (region IN ('norte', 'centro', 'sur')) NOT NULL,
    hash_anterior VARCHAR(64) NOT NULL,
    hash_actual VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    detalles JSONB,
    ip_origen VARCHAR(45),
    hash_anterior VARCHAR(64),
    hash_actual VARCHAR(64),
    fecha TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_donantes_tipo ON donantes(id_tipo_sangre);
CREATE INDEX IF NOT EXISTS idx_donantes_disponible ON donantes(disponible);
CREATE INDEX IF NOT EXISTS idx_donantes_region ON donantes(region);
CREATE INDEX IF NOT EXISTS idx_historial_donante ON historial_donaciones(id_donante_hash);
CREATE INDEX IF NOT EXISTS idx_historial_region ON historial_donaciones(region);
CREATE INDEX IF NOT EXISTS idx_historial_hash ON historial_donaciones(hash_actual);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_logs(fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_logs(id_usuario);