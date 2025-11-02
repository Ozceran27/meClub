-- Actualiza reservas con contacto y seguimiento de creador
ALTER TABLE reservas
  MODIFY COLUMN usuario_id INT NULL,
  ADD COLUMN tipo_reserva ENUM('relacionada','privada') NOT NULL DEFAULT 'relacionada' AFTER estado,
  ADD COLUMN contacto_nombre VARCHAR(100) NULL AFTER tipo_reserva,
  ADD COLUMN contacto_apellido VARCHAR(100) NULL AFTER contacto_nombre,
  ADD COLUMN contacto_telefono VARCHAR(25) NULL AFTER contacto_apellido,
  ADD COLUMN creado_por_id INT NOT NULL AFTER contacto_telefono,
  ADD COLUMN monto_base DECIMAL(10,2) NULL AFTER monto,
  ADD COLUMN monto_grabacion DECIMAL(10,2) NULL AFTER monto_base,
  ADD CONSTRAINT fk_reservas_creador FOREIGN KEY (creado_por_id) REFERENCES usuarios(usuario_id);

UPDATE reservas
SET tipo_reserva = 'relacionada',
    creado_por_id = usuario_id,
    monto_base = monto,
    monto_grabacion = CASE WHEN grabacion_solicitada = 1 THEN 0 ELSE NULL END
WHERE creado_por_id IS NULL;

ALTER TABLE clubes
  ADD COLUMN precio_grabacion DECIMAL(10,2) NULL AFTER email_contacto;
