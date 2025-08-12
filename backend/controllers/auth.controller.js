const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UsuariosModel = require('../models/usuarios.model');
const ClubesModel = require('../models/clubes.model');

exports.register = async (req, res) => {
  const {
    nombre, apellido, email, contrasena,
    rol = 'deportista',
    nombre_club, descripcion_club, foto_logo, nivel_id
  } = req.body;

  try {
    const usuarioExistente = await UsuariosModel.buscarPorEmail(email);
    if (usuarioExistente.length > 0) {
      return res.status(400).json({ mensaje: 'El email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const nuevoUsuario = await UsuariosModel.crearUsuario({
      nombre,
      apellido,
      email,
      contrasena: hashedPassword,
      rol,
    });

    let clubCreado = null;
    if (rol === 'club') {
      const nivel = Number.isInteger(nivel_id) ? nivel_id : 1;
      clubCreado = await ClubesModel.crearClub({
        nombre: nombre_club || `Club de ${nombre}`,
        descripcion: descripcion_club || null,
        usuario_id: nuevoUsuario.usuario_id,
        nivel_id: nivel,
        foto_logo: foto_logo || null,
      });
    }

    res.status(201).json({
      mensaje: 'Usuario registrado correctamente',
      usuario: nuevoUsuario,
      club: clubCreado,
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

exports.login = async (req, res) => {
  const { email, contrasena } = req.body;

  try {
    const usuarios = await UsuariosModel.buscarPorEmail(email);
    if (usuarios.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];
    const esValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!esValida) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { usuario_id: usuario.usuario_id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        usuario_id: usuario.usuario_id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};
