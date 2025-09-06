/**
 * Obtiene el identificador de un usuario.
 * @param {object} user - Objeto de usuario que puede tener las propiedades `id` o `usuario_id`.
 * @returns {*} Identificador del usuario, o `undefined` si no está disponible.
 */
function getUserId(user) {
  return user?.id ?? user?.usuario_id;
}

module.exports = { getUserId };
