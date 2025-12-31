ALTER TABLE club_servicios
  ADD COLUMN servicio_catalogo_id int unsigned DEFAULT NULL AFTER club_id,
  ADD KEY idx_club_servicios_catalogo (servicio_catalogo_id),
  ADD CONSTRAINT fk_club_servicios_catalogo
    FOREIGN KEY (servicio_catalogo_id)
    REFERENCES servicios (servicio_id)
    ON DELETE SET NULL;
