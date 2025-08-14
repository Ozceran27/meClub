const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3006;

// MIDDLEWARES ------------------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const clubesRoutes = require('./routes/clubes.routes');
const deportesRoutes = require('./routes/deportes.routes');
const reservasRoutes = require('./routes/reservas.routes');
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clubes', clubesRoutes);
app.use('/api/deportes', deportesRoutes);
app.use('/api/reservas', reservasRoutes);

// INFO API ------------------------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send('API de meClub funcionando correctamente.');
});


// RUN SERVER -------------------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});

