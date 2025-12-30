const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const asociadosController = require('../controllers/asociados.controller');

router.use(verifyToken, requireRole('club'), loadClub);

router.get('/tipos', asociadosController.listTipos);
router.post('/tipos', asociadosController.createTipo);
router.put('/tipos/:tipo_asociado_id', asociadosController.updateTipo);
router.delete('/tipos/:tipo_asociado_id', asociadosController.deleteTipo);

router.get('/', asociadosController.listAsociados);
router.post('/', asociadosController.createAsociado);
router.delete('/:asociado_id', asociadosController.deleteAsociado);

module.exports = router;
