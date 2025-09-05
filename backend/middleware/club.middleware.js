const ClubesModel = require('../models/clubes.model');

const getUserId = (u) => u?.id ?? u?.usuario_id;

const loadClub = async (req, res, next) => {
  try {
    const usuarioId = getUserId(req.usuario);
    if (!usuarioId) {
      return res.status(403).json({ mensaje: 'Token sin identificador de usuario' });
    }

    const club = await ClubesModel.obtenerClubPorPropietario(usuarioId);
    if (!club) {
      return res.status(404).json({ mensaje: 'No tienes club relacionado' });
    }

    req.club = club;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = loadClub;
