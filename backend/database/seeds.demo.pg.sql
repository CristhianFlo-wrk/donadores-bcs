-- Usuarios demo SOLO para desarrollo y tests. Nunca se cargan en produccion
-- usuarios demo 
-- admin@demo.donadores.mx / Admin12345
-- hospitalN@demo.donadores.mx / Hospital123 
INSERT INTO usuarios (email, password_hash, rol, id_hospital) VALUES
('admin@demo.donadores.mx', '$2b$10$hxnDCz6DGtREU438MjE4jOeFC4aanw60u2vTCA2Mxv6n1Jh4N/o/y', 'admin', NULL);

INSERT INTO usuarios (email, password_hash, rol, id_hospital)
SELECT 'hospital' || id || '@demo.donadores.mx',
       '$2b$10$rlv2qmEqR1nMOSWUFL/SIuOCIdiv1yGYsMm.mUWr.MmsKPLb/vIq6',
       'hospital',
       id
FROM hospitales
ORDER BY id;
