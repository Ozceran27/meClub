const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const UsuariosModel = require('../models/usuarios.model');
const ClubesModel = require('../models/clubes.model');
const MessagesModel = require('../models/messages.model');
const logger = require('../utils/logger');
const db = require('../config/db');

const mapClubResponse = (club) => {
  if (!club) return null;
  const {
    club_id,
    nombre,
    cuit = null,
    descripcion = null,
    nivel_id = null,
    foto_logo = null,
    foto_portada = null,
    provincia_id = null,
    localidad_id = null,
  } = club;

  return {
    club_id,
    nombre,
    cuit,
    descripcion,
    nivel_id,
    foto_logo,
    foto_portada,
    provincia_id,
    localidad_id,
  };
};

const normalizeCuit = (value) => {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ mensaje: errors.array()[0].msg });
  }
  const {
    nombre, apellido, email, contrasena, telefono,
    rol = 'deportista',
    nombre_club, cuit
  } = req.body;

  const normalizedCuit = rol === 'club' ? normalizeCuit(cuit) : null;
  if (rol === 'club') {
    if (!nombre_club || !String(nombre_club).trim()) {
      return res.status(400).json({ mensaje: 'Nombre del club requerido' });
    }
    if (!normalizedCuit) {
      return res.status(400).json({ mensaje: 'CUIT inválido' });
    }
  }

  let connection;
  try {
    const usuarioExistente = await UsuariosModel.buscarPorEmail(email);
    if (usuarioExistente.length > 0) {
      return res.status(400).json({ mensaje: 'El email ya está registrado' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const nuevoUsuario = await UsuariosModel.crearUsuario({
      nombre,
      apellido,
      email,
      contrasena: hashedPassword,
      telefono,
      rol,
    }, connection);

    let clubCreado = null;
    if (rol === 'club') {
      clubCreado = await ClubesModel.crearClub({
        nombre: nombre_club,
        cuit: normalizedCuit,
        usuario_id: nuevoUsuario.usuario_id,
        nivel_id: 1,
      }, connection);

      if (clubCreado?.club_id) {
        try {
          await MessagesModel.createMessage({
            club_id: clubCreado.club_id,
            type: 'info',
            title: '¡Bienvenido a MeClub!',
            content:
              'Tu club ya está listo. Invita a tu equipo y personaliza tu perfil para comenzar a recibir reservas.',
            sender: 'Sistema',
            broadcast: true,
            connection,
          });
        } catch (messageError) {
          logger.error('No se pudo crear el mensaje de bienvenida del club:', messageError);
        }
      }
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado');
    }

    const token = jwt.sign(
      {
        usuario_id: nuevoUsuario.usuario_id,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
      },
      process.env.JWT_SECRET
    );

    const clubInfo = mapClubResponse(clubCreado);

    await connection.commit();

    res.status(201).json({
      mensaje: 'Usuario registrado correctamente',
      token,
      usuario: nuevoUsuario,
      club: clubInfo,
    });
  } catch (error) {
    logger.error('Error en registro:', error);
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.error('Error al hacer rollback:', rollbackError);
      }
    }
    res.status(500).json({ mensaje: error.message || 'Error en el servidor' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ mensaje: errors.array()[0].msg });
  }
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

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado');
    }

    const token = jwt.sign(
      { usuario_id: usuario.usuario_id, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET
    );

    // Si el usuario es un club, buscamos los datos básicos del club
    let clubInfo = null;
    if (usuario.rol === 'club') {
      try {
        const club = await ClubesModel.obtenerClubPorPropietario(usuario.usuario_id);
        if (club) {
          clubInfo = mapClubResponse(club);
        }
      } catch (err) {
        logger.error('Error obteniendo club del usuario', err);
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

    if (clubInfo) {
      respuesta.club = clubInfo;
      respuesta.usuario.foto_logo = clubInfo.foto_logo ?? null;
    } else if (!('foto_logo' in respuesta.usuario)) {
      respuesta.usuario.foto_logo = null;
    }

    res.json(respuesta);
  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({ mensaje: error.message || 'Error en el servidor' });
  }
};
