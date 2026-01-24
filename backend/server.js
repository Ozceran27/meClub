require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const { initAsociadosTablesCheck } = require('./utils/asociadosTablesGuard');
const { logosDir, logosPublicPath } = require('./utils/logoStorage');
const { startEventosFinalizacionJob } = require('./utils/eventosFinalizacionJob');
const app = express();
const PORT = process.env.PORT || 3006;

const normalizeOrigins = (raw) =>
  raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const corsOrigins = process.env.CORS_ORIGIN
  ? normalizeOrigins(process.env.CORS_ORIGIN)
  : ['*'];

// MIDDLEWARES ------------------------------------------------------------------------------------
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes('*')) {
      return callback(null, true);
    }
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Timezone', 'X-Client-Timezone-Offset'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
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
const promocionesRoutes = require('./routes/promociones.routes');
const cuponesRoutes = require('./routes/cupones.routes');
const messagesRoutes = require('./routes/messages.routes');
const asociadosRoutes = require('./routes/asociados.routes');
const eventosRoutes = require('./routes/eventos.routes');
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clubes', clubesRoutes);
app.use('/api/deportes', deportesRoutes);
app.use('/api/niveles', nivelesRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/provincias', provinciasRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/promociones', promocionesRoutes);
app.use('/api/cupones', cuponesRoutes);
app.use('/api/mensajes', messagesRoutes);
app.use('/api/asociados', asociadosRoutes);
app.use('/api/eventos', eventosRoutes);

// INFO API -----------------------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send('API de meClub funcionando correctamente.');
});

initAsociadosTablesCheck();
startEventosFinalizacionJob();

// RUN SERVER -------------------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor backend escuchando en http://0.0.0.0:${PORT}`);
});
