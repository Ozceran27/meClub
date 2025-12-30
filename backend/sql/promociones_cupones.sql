-- Promociones y cupones

CREATE TABLE IF NOT EXISTS promociones (
  promocion_id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NOT NULL,
  tipo_descuento ENUM('porcentaje', 'nominal') NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  canchas_aplicadas TEXT,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promociones_club (club_id)
);

CREATE TABLE IF NOT EXISTS cupones (
  cupon_id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  usos_permitidos INT NOT NULL,
  usos_realizados INT NOT NULL DEFAULT 0,
  tipo_descuento ENUM('porcentaje', 'nominal') NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cupones_club (club_id)
);

CREATE TABLE IF NOT EXISTS cupon_usos (
  cupon_uso_id INT AUTO_INCREMENT PRIMARY KEY,
  cupon_id INT NOT NULL,
  reserva_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  usado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cupon_usos_cupon (cupon_id)
);
