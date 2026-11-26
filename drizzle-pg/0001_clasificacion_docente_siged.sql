ALTER TABLE docente
  ALTER COLUMN categoria_id DROP NOT NULL,
  ALTER COLUMN dedicacion_id DROP NOT NULL;

INSERT INTO categoria_docente (id, nombre, orden) VALUES (4, 'B', -1);
INSERT INTO dedicacion (id, nombre) VALUES (3, 'Tiempo parcial'), (4, 'B1'), (5, 'B2');
