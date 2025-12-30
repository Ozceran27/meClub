require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const { logosDir, logosPublicPath } = require('./utils/logoStorage');
const app = express();
const PORT = process.env.PORT || 3006;
const PasswordResetsModel = require('./models/passwordResets.model');

// MIDDLEWARES ------------------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(logosPublicPath, express.static(logosDir));
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const clubesRoutes = require('./routes/clubes.routes');
const deportesRoutes = require('./routes/deportes.routes');
const nivelesRoutes = require('./routes/niveles.routes');
const reservasRoutes = require('./routes/reservas.routes');
const provinciasRoutes = require('./routes/provincias.routes');
const catalogoRoutes = require('./routes/catalogo.routes');
const serviciosRoutes = require('./routes/servicios.routes');
const messagesRoutes = require('./routes/messages.routes');
const asociadosRoutes = require('./routes/asociados.routes');
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clubes', clubesRoutes);
app.use('/api/deportes', deportesRoutes);
app.use('/api/niveles', nivelesRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/provincias', provinciasRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/mensajes', messagesRoutes);
app.use('/api/asociados', asociadosRoutes);

// INFO API -----------------------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send('API de meClub funcionando correctamente.');
});

// PURGA DE TOKENS EXPIRADOS -----------------------------------------------------------------------
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
setInterval(async () => {
  try {
    await PasswordResetsModel.deleteExpired();
  } catch (err) {
    logger.error('Error purgando tokens de reseteo:', err);
  }
}, PURGE_INTERVAL_MS);

// RUN SERVER -------------------------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`Servidor backend escuchando en http://localhost:${PORT}`);
});
