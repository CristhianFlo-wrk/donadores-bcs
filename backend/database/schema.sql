-- ============================================
-- SISTEMA DE DONADORES DE SANGRE BCS
-- Esquema v2.0 (se ejecuta en cada nodo)
-- ============================================

CREATE TABLE IF NOT EXISTS tipos_sangre (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    grupo TEXT NOT NULL,
    rh TEXT NOT NULL CHECK(rh IN ('+', '-')),
    descripcion TEXT,
    es_donante_universal INTEGER DEFAULT 0,
    es_receptor_universal INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compatibilidad_sanguinea (
    id_donante INTEGER NOT NULL,
    id_receptor INTEGER NOT NULL,
    PRIMARY KEY (id_donante, id_receptor),
    FOREIGN KEY (id_donante) REFERENCES tipos_sangre(id),
    FOREIGN KEY (id_receptor) REFERENCES tipos_sangre(id)
);

CREATE TABLE IF NOT EXISTS municipios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    id_nodo TEXT CHECK(id_nodo IN ('norte', 'centro', 'sur')) NOT NULL,
    latitud REAL,
    longitud REAL,
    activo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS colonias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_municipio INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    codigo_postal TEXT,
    latitud REAL,
    longitud REAL,
    activo INTEGER DEFAULT 1,
    FOREIGN KEY (id_municipio) REFERENCES municipios(id),
    UNIQUE(id_municipio, nombre)
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('donante', 'hospital', 'admin')) NOT NULL,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER UNIQUE NOT NULL,
    nombre_cifrado TEXT NOT NULL,
    curp_hash TEXT UNIQUE NOT NULL,
    fecha_nacimiento TEXT,
    sexo TEXT CHECK(sexo IN ('M', 'F', 'otro')),
    telefono_cifrado TEXT,
    id_tipo_sangre INTEGER NOT NULL,
    id_colonia INTEGER,
    colonia_personalizada TEXT,
    latitud REAL,
    longitud REAL,
    id_nodo TEXT CHECK(id_nodo IN ('norte', 'centro', 'sur')),
    disponible INTEGER DEFAULT 1,
    peso_kg REAL CHECK(peso_kg >= 50),
    ha_donado_antes INTEGER DEFAULT 0,
    ultima_donacion DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
    FOREIGN KEY (id_tipo_sangre) REFERENCES tipos_sangre(id),
    FOREIGN KEY (id_colonia) REFERENCES colonias(id)
);

CREATE TABLE IF NOT EXISTS hospitales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    institucion TEXT CHECK(institucion IN ('IMSS', 'ISSSTE', 'SSBCS', 'otro')),
    id_nodo TEXT CHECK(id_nodo IN ('norte', 'centro', 'sur')),
    direccion TEXT,
    telefono TEXT,
    latitud REAL,
    longitud REAL,
    activo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_hospital INTEGER NOT NULL,
    id_tipo_sangre INTEGER NOT NULL,
    urgencia TEXT CHECK(urgencia IN ('critica', 'urgente')) NOT NULL,
    estado TEXT CHECK(estado IN ('activa', 'completada', 'cancelada')) DEFAULT 'activa',
    descripcion TEXT,
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME,
    FOREIGN KEY (id_hospital) REFERENCES hospitales(id),
    FOREIGN KEY (id_tipo_sangre) REFERENCES tipos_sangre(id)
);

CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_solicitud INTEGER NOT NULL,
    id_donante INTEGER NOT NULL,
    canal TEXT CHECK(canal IN ('push', 'sms')) NOT NULL,
    estado TEXT CHECK(estado IN ('enviada', 'confirmada', 'rechazada')) DEFAULT 'enviada',
    fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta DATETIME,
    FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id),
    FOREIGN KEY (id_donante) REFERENCES donantes(id)
);

CREATE TABLE IF NOT EXISTS historial_blockchain (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_donante_hash TEXT NOT NULL,
    fecha_donacion DATETIME NOT NULL,
    grupo_sanguineo TEXT NOT NULL,
    id_hospital INTEGER NOT NULL,
    id_nodo TEXT CHECK(id_nodo IN ('norte', 'centro', 'sur')) NOT NULL,
    hash_anterior TEXT NOT NULL,
    hash_actual TEXT NOT NULL,
    firma_hospital TEXT,
    origen_replicacion TEXT,
    recibido_en DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_hospital) REFERENCES hospitales(id)
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER,
    accion TEXT NOT NULL,
    detalles TEXT,
    ip_origen TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_donantes_tipo ON donantes(id_tipo_sangre);
CREATE INDEX IF NOT EXISTS idx_donantes_disponible ON donantes(disponible);
CREATE INDEX IF NOT EXISTS idx_donantes_nodo ON donantes(id_nodo);
CREATE INDEX IF NOT EXISTS idx_blockchain_donante ON historial_blockchain(id_donante_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_nodo ON historial_blockchain(id_nodo);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);