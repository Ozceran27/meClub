const SQL = `
CREATE TABLE IF NOT EXISTS club_servicios (
  servicio_id int unsigned NOT NULL AUTO_INCREMENT,
  club_id int NOT NULL,
  nombre varchar(120) NOT NULL,
  modo_acceso varchar(20) NOT NULL DEFAULT 'libre',
  dias_disponibles varchar(120) DEFAULT NULL,
  hora_inicio time DEFAULT NULL,
  hora_fin time DEFAULT NULL,
  imagen_url varchar(255) DEFAULT NULL,
  ambiente varchar(20) DEFAULT NULL,
  precio_tipo varchar(10) DEFAULT NULL,
  precio_valor decimal(10, 2) DEFAULT NULL,
  no_fumar tinyint(1) NOT NULL DEFAULT 0,
  mas_18 tinyint(1) NOT NULL DEFAULT 0,
  comida tinyint(1) NOT NULL DEFAULT 0,
  eco_friendly tinyint(1) NOT NULL DEFAULT 0,
  activo tinyint(1) NOT NULL DEFAULT 1,
  creado_en datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (servicio_id),
  KEY idx_club_servicios_club (club_id),
  CONSTRAINT fk_club_servicios_club FOREIGN KEY (club_id)
    REFERENCES clubes (club_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`;

module.exports = { SQL };
