-- tipos de sangre
INSERT INTO tipos_sangre (id, codigo, grupo, rh, descripcion, es_donante_universal, es_receptor_universal) VALUES
(1, 'O-',  'O',  '-', 'Donante universal', TRUE,  FALSE),
(2, 'O+',  'O',  '+', 'Donante comun',     FALSE, FALSE),
(3, 'A-',  'A',  '-', 'Donante para A y AB', FALSE, FALSE),
(4, 'A+',  'A',  '+', 'Donante comun',     FALSE, FALSE),
(5, 'B-',  'B',  '-', 'Donante para B y AB', FALSE, FALSE),
(6, 'B+',  'B',  '+', 'Donante comun',     FALSE, FALSE),
(7, 'AB-', 'AB', '-', 'Donante para AB',   FALSE, FALSE),
(8, 'AB+', 'AB', '+', 'Receptor universal', FALSE, TRUE);

INSERT INTO compatibilidad_sanguinea VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),
(2,2),(2,4),(2,6),(2,8),
(3,3),(3,4),(3,7),(3,8),
(4,4),(4,8),
(5,5),(5,6),(5,7),(5,8),
(6,6),(6,8),
(7,7),(7,8),
(8,8);

INSERT INTO municipios (id, nombre, region, latitud, longitud) VALUES
(1, 'Mulege',    'norte',  27.3333, -112.2667),
(2, 'Loreto',    'centro', 26.0122, -111.3458),
(3, 'Comondu',   'centro', 25.0322, -111.6634),
(4, 'La Paz',    'sur',    24.1426, -110.3128),
(5, 'Los Cabos', 'sur',    23.0614, -109.6970);

INSERT INTO colonias (id_municipio, nombre, codigo_postal, latitud, longitud) VALUES
(1, 'Santa Rosalia Centro', '23920', 27.3389, -112.2678),
(1, 'Heroica Mulege',       '23900', 26.8911, -111.9819),
(1, 'Otra',                 NULL,    NULL,    NULL),

(2, 'Loreto Centro', '23880', 26.0122, -111.3458),
(2, 'Nopolo',        '23884', 25.9894, -111.3545),
(2, 'Otra',          NULL,    NULL,    NULL),

(3, 'Ciudad Constitucion Centro', '23600', 25.0322, -111.6634),
(3, 'Ciudad Insurgentes',         '23700', 25.2667, -111.7833),
(3, 'Puerto San Carlos',          '23740', 24.7947, -112.1058),
(3, 'Otra',                       NULL,    NULL,    NULL),

(4, 'Centro',       '23000', 24.1426, -110.3128),
(4, 'El Esterito',  '23020', 24.1669, -110.3060),
(4, 'Bella Vista',  '23050', 24.1256, -110.3095),
(4, 'Pedregal',     '23060', 24.1289, -110.3187),
(4, 'Independencia','23070', 24.1478, -110.3089),
(4, 'Guerrero',     '23080', 24.1501, -110.3156),
(4, 'Arco Iris',    '23090', 24.1234, -110.3278),
(4, 'Las Palmas',   '23100', 24.1189, -110.3345),
(4, 'Fidepaz',      '23093', 24.1389, -110.2987),
(4, 'Otra',         NULL,    NULL,    NULL),

(5, 'San Jose del Cabo Centro', '23400', 23.0614, -109.6970),
(5, 'Cabo San Lucas Centro',    '23450', 22.8822, -109.9133),
(5, 'El Medano',                '23453', 22.8906, -109.9059),
(5, 'Pedregal CSL',             '23454', 22.8845, -109.9189),
(5, 'La Playita',               '23455', 22.8956, -109.9234),
(5, 'San Jose Viejo',           '23420', 23.0567, -109.7012),
(5, 'Otra',                     NULL,    NULL,    NULL);

INSERT INTO hospitales (id, nombre, institucion, region, direccion, latitud, longitud) VALUES
(1, 'IMSS HGZ No. 1 La Paz', 'IMSS', 'sur',
 'Blvd. 5 de Febrero 725, Col. Pueblo Nuevo, La Paz, BCS',
 24.1481, -110.3168),

(2, 'ISSSTE Dra. Columba Rivera', 'ISSSTE', 'sur',
 'Av. De los Deportistas, La Paz, BCS',
 24.1332, -110.3308),

(3, 'Hospital General Salvatierra', 'SSBCS', 'sur',
 'Av. de los Deportistas 86, Col. 3 de Mayo, La Paz, BCS',
 24.1129, -110.3182),

(4, 'IMSS HGMF No. 6 Cd. Constitucion', 'IMSS', 'centro',
 'Blvd. Olachea, Cd. Constitucion, BCS',
 25.0340, -111.6460),

(5, 'Hospital General Cd. Constitucion', 'SSBCS', 'centro',
 'Blvd. Hugo Cervantes del Rio S/N, Fracc. San Martin, Cd. Constitucion, BCS',
 25.0313, -111.6746),

(6, 'IMSS HGMF No. 26 Cabo San Lucas', 'IMSS', 'sur',
 'Carretera Transpeninsular Km 2.5, Col. Brisas del Pacifico, Cabo San Lucas, BCS',
 22.8995, -109.9279),

(7, 'ISSSTE San Jose del Cabo', 'ISSSTE', 'sur',
 'Calle Tifon, Col. Rosarito, San Jose del Cabo, BCS',
 23.0687, -109.7087),

(8, 'Hospital General San Jose', 'SSBCS', 'sur',
 'Col. Guaymitas, San Jose del Cabo, BCS',
 23.0618, -109.7076);