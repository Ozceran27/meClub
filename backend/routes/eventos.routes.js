const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const { buildSingleUploadMiddleware } = require('../middleware/logoUpload.middleware');
const eventosController = require('../controllers/eventos.controller');

router.get('/globales', verifyToken, eventosController.listEventosGlobales);
router.get('/globales/:evento_id', verifyToken, eventosController.getEventoGlobal);

router.use(verifyToken, requireRole('club'), loadClub);

const uploadEventoImagen = buildSingleUploadMiddleware('imagen');
const uploadEventoReglamento = buildSingleUploadMiddleware('reglamento');

router.get('/', eventosController.listEventos);
router.get('/:evento_id', eventosController.getEvento);
router.post('/', eventosController.createEvento);
router.put('/:evento_id', eventosController.updateEvento);
router.get('/:evento_id/sedes', eventosController.listEventoSedes);
router.put('/:evento_id/sedes', eventosController.updateEventoSedes);
router.post('/:evento_id/imagen', uploadEventoImagen, eventosController.uploadEventoImagen);
router.post('/:evento_id/reglamento', uploadEventoReglamento, eventosController.uploadEventoReglamento);
router.get('/:evento_id/reglamento', eventosController.getEventoReglamento);
router.delete('/:evento_id', eventosController.deleteEvento);

router.post('/:evento_id/iniciar', eventosController.iniciarEvento);
router.post('/:evento_id/pausar', eventosController.pausarEvento);
router.post('/:evento_id/finalizar', eventosController.finalizarEvento);

router.post('/:evento_id/equipos', eventosController.inscribirEquipo);
router.post('/:evento_id/equipos/:evento_equipo_id/aprobar', eventosController.aprobarEquipo);
router.post('/:evento_id/equipos/:evento_equipo_id/rechazar', eventosController.rechazarEquipo);

router.post('/:evento_id/partidos', eventosController.createPartido);
router.put('/:evento_id/partidos/:evento_partido_id', eventosController.updatePartido);
router.post('/:evento_id/partidos/:evento_partido_id/ganador', eventosController.setGanadorPartido);

router.post('/:evento_id/posiciones', eventosController.createPosicion);
router.put('/:evento_id/posiciones/:evento_posicion_id', eventosController.updatePosicion);

module.exports = router;
