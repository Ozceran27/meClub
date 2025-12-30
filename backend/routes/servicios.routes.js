const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const serviciosController = require('../controllers/servicios.controller');

router.use(verifyToken, requireRole('club'), loadClub);

router.get('/', serviciosController.listServicios);
router.post('/', serviciosController.createServicio);
router.put('/:servicio_id', serviciosController.updateServicio);
router.delete('/:servicio_id', serviciosController.deleteServicio);

module.exports = router;
