const EventosModel = require('../models/eventos.model');
const logger = require('./logger');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

const createEventosFinalizacionRunner = () => async () => {
  try {
    const { actualizados, eventos } = await EventosModel.finalizarEventosVencidos(new Date());
    if (actualizados > 0) {
      const ids = eventos.map((evento) => `#${evento.evento_id}`).join(', ');
      logger.info(`Eventos finalizados automáticamente: ${actualizados}.`, ids);
    }
  } catch (error) {
    logger.error('Error al finalizar eventos vencidos.', error);
  }
};

const startEventosFinalizacionJob = () => {
  const intervalMs = Number(process.env.EVENTOS_FINALIZAR_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  const run = createEventosFinalizacionRunner();
  run();
  setInterval(run, intervalMs);
};

module.exports = {
  startEventosFinalizacionJob,
};
