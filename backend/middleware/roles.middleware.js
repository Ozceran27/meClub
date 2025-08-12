const requireRole = (role) => (req, res, next) => {
  try {
    if (!req.usuario || !req.usuario.rol) {
      return res.status(401).json({ mensaje: 'Usuario no autenticado' });
    }
    if (req.usuario.rol !== role) {
      return res.status(403).json({ mensaje: 'No tienes permisos para esta operación' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};

module.exports = { requireRole };
