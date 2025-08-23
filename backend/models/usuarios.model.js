const db = require('../config/db');

const UsuariosModel = {
  buscarPorEmail: async (email) => {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    return rows;
  },

  // Crear usuario
  crearUsuario: async ({
    nombre,
    apellido,
    email,
    contrasena,
    rol = 'deportista',
    telefono = null,
    provincia_id = null,
    localidad_id = null,
    foto_perfil = null,
  }) => {
    const [result] = await db.query(
      `INSERT INTO usuarios
       (nombre, apellido, email, telefono, provincia_id, localidad_id, contrasena, rol, foto_perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido || null, email, telefono, provincia_id, localidad_id, contrasena, rol, foto_perfil]
    );

    return {
      usuario_id: result.insertId,
      nombre,
      apellido: apellido || null,
      email,
      rol,
    };
  },

  buscarPorId: async (usuario_id) => {
    const [rows] = await db.query(
      'SELECT usuario_id, nombre, apellido, email, rol FROM usuarios WHERE usuario_id = ?',
      [usuario_id]
    );
    return rows[0] || null;
  },

  // Actualiza la contraseña (hash ya generado) por usuario_id
  actualizarContrasena: async (usuario_id, contrasenaHash) => {
    const [result] = await db.query(
      'UPDATE usuarios SET contrasena = ? WHERE usuario_id = ?',
      [contrasenaHash, usuario_id]
    );
    return result.affectedRows === 1;
  },

  actualizarContrasenaPorEmail: async (email, contrasenaHash) => {
    const [result] = await db.query(
      'UPDATE usuarios SET contrasena = ? WHERE email = ?',
      [contrasenaHash, email]
    );
    return result.affectedRows === 1;
  },
};

module.exports = UsuariosModel;
