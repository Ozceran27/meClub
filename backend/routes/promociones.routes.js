const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const promocionesController = require('../controllers/promociones.controller');

router.use(verifyToken, requireRole('club'), loadClub);

router.get('/', promocionesController.listPromociones);
router.post('/', promocionesController.createPromocion);
router.put('/:promocion_id', promocionesController.updatePromocion);
router.delete('/:promocion_id', promocionesController.deletePromocion);

module.exports = router;
