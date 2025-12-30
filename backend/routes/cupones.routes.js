const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const cuponesController = require('../controllers/cupones.controller');

router.use(verifyToken, requireRole('club'), loadClub);

router.get('/', cuponesController.listCupones);
router.post('/', cuponesController.createCupon);
router.put('/:cupon_id', cuponesController.updateCupon);
router.delete('/:cupon_id', cuponesController.deleteCupon);
router.post('/:cupon_id/usos', cuponesController.registerCuponUse);

module.exports = router;
