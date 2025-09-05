const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UsuariosModel = require('../models/usuarios.model');
const ClubesModel = require('../models/clubes.model');
const PasswordResetsModel = require('../models/passwordResets.model');

const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutos
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

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
      token,
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

    // Si el usuario es un club, buscamos los datos básicos del club
    let clubInfo = null;
    if (usuario.rol === 'club') {
      try {
        const club = await ClubesModel.obtenerClubPorPropietario(usuario.usuario_id);
        if (club) {
          clubInfo = { club_id: club.club_id, nombre: club.nombre };
        }
      } catch (err) {
        console.error('Error obteniendo club del usuario', err);
      }
    }

    const respuesta = {
      mensaje: 'Login exitoso',
      token,
      usuario: {
        usuario_id: usuario.usuario_id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        rol: usuario.rol,
      },
    };

    if (clubInfo) respuesta.club = clubInfo;

    res.json(respuesta);
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// ====== Solicitud de reseteo ===========================
exports.forgot = async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ mensaje: 'Email requerido' });

  try {
    const usuarios = await UsuariosModel.buscarPorEmail(email);
    if (usuarios.length === 0) {
      return res.json({ mensaje: 'Si el email existe, enviamos instrucciones' });
    }

    const user = usuarios[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expira = new Date(Date.now() + RESET_TTL_MS);
    await PasswordResetsModel.insert(tokenHash, user.usuario_id, expira);

    const frontBase = process.env.FRONT_BASE_URL || 'http://localhost:19006';
    const link = `${frontBase}/reset?token=${rawToken}`;

    // En producción = enviar email. En dev devuelve el token/link.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[meClub] Link de reseteo:', link);
      return res.json({ mensaje: 'Instrucciones enviadas', token: rawToken, link });
    }
    return res.json({ mensaje: 'Instrucciones enviadas' });
  } catch (error) {
    console.error('Error en forgot:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};

// ====== Reset con token ================================
exports.reset = async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ mensaje: 'Token y nueva contraseña requeridos' });
  }

  try {
    const tokenHash = hashToken(token);
    const entry = await PasswordResetsModel.findByHash(tokenHash);
    if (!entry || new Date(entry.expira) < new Date()) {
      if (entry) await PasswordResetsModel.delete(tokenHash);
      return res.status(400).json({ mensaje: 'Token inválido o expirado' });
    }

    const hashed = await bcrypt.hash(password, 10);

    // IMPORTANTE: tu modelo debería exponer actualizarContrasena(usuario_id, contrasenaHasheada)
    if (typeof UsuariosModel.actualizarContrasena !== 'function') {
      console.error('Falta UsuariosModel.actualizarContrasena(usuario_id, hash)');
      return res.status(500).json({ mensaje: 'No se pudo actualizar la contraseña (método inexistente)' });
    }

    await UsuariosModel.actualizarContrasena(entry.usuario_id, hashed);
    await PasswordResetsModel.delete(tokenHash);

    return res.json({ mensaje: 'Contraseña actualizada' });
  } catch (error) {
    console.error('Error en reset:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
};
