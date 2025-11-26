const path = require('path');
const dotenv = require('dotenv');

const envPaths = [path.resolve(__dirname, '../.env'), path.resolve(__dirname, '../backend/.env')];
envPaths.forEach((envPath) => dotenv.config({ path: envPath }));

const ClubesModel = require('../backend/models/clubes.model');
const MessagesModel = require('../backend/models/messages.model');

const MESSAGE_TITLE = '¡Bienvenid@s a meClub!';
const MESSAGE_CONTENT =
  'Ya pueden reservar canchas, crear clubes y enviar notificaciones a todos los integrantes.';

async function enviarBienvenida() {
  const clubIds = await ClubesModel.listClubIds();

  if (!clubIds.length) {
    console.log('No se encontraron clubes para enviar el mensaje.');
    return;
  }

  for (const clubId of clubIds) {
    const message = await MessagesModel.createMessage({
      club_id: clubId,
      title: MESSAGE_TITLE,
      content: MESSAGE_CONTENT,
      broadcast: true,
    });

    console.log(`Mensaje creado para el club ${clubId}: id ${message.id}`);
  }

  console.log('Envio de mensajes de bienvenida completado.');
}

enviarBienvenida().catch((error) => {
  console.error('Error al enviar los mensajes de bienvenida:', error);
  process.exit(1);
});
