const jwt = require('jsonwebtoken');

const { JWT_SECRET } = process.env;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const verifyToken = (req, res, next) => {
  let token = req.headers['authorization'];
  if (!token) return res.status(403).json({ mensaje: 'Token no proporcionado' });
  if (token.startsWith('Bearer ')) token = token.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Normalizador usuario_id a id
    if (!decoded.id && decoded.usuario_id) decoded.id = decoded.usuario_id;
    req.usuario = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

module.exports = verifyToken;
