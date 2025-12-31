const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roles.middleware');
const loadClub = require('../middleware/club.middleware');
const { buildSingleUploadMiddleware } = require('../middleware/logoUpload.middleware');

const ClubesModel = require('../models/clubes.model');
const CanchasModel = require('../models/canchas.model');
const ClubesHorarioModel = require('../models/clubesHorario.model');
const ReservasModel = require('../models/reservas.model');
const TarifasModel = require('../models/tarifas.model');
const ProvinciasModel = require('../models/provincias.model');
const LocalidadesModel = require('../models/localidades.model');
const ServiciosModel = require('../models/servicios.model');
const ClubServiciosModel = require('../models/clubServicios.model');
const ClubesImpuestosModel = require('../models/clubesImpuestos.model');
const GastosModel = require('../models/gastos.model');
const { normalizeHour } = require('../utils/datetime');

// Aplica middlewares de autenticación/rol y carga de club
router.use(
  [
    '/mis-datos',
    '/mis-canchas',
    '/canchas',
    '/mis-horarios',
    '/mis-tarifas',
    '/mis-servicios',
    '/mis-impuestos',
    '/mis-gastos',
  ],
  verifyToken,
  requireRole('club'),
  loadClub
);

const uploadClubLogo = buildSingleUploadMiddleware('logo');
const uploadCanchaImagen = buildSingleUploadMiddleware('imagen');

const ESTADOS_CANCHA = new Set(['disponible', 'mantenimiento', 'inactiva']);

const throwValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const parseNullableString = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throwValidationError(`${fieldName} debe ser una cadena`);
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const parseIcono = (value) => {
  const parsed = parseNullableString(value, 'icono');
  if (parsed === undefined || parsed === null) return parsed;

  return parsed.slice(0, 64);
};

const parsePositiveInteger = (value, fieldName, { required = false } = {}) => {
  if (value === undefined) {
    if (required) {
      throwValidationError(`${fieldName} es obligatorio`);
    }
    return undefined;
  }
  if (value === null || value === '') {
    if (required) {
      throwValidationError(`${fieldName} es obligatorio`);
    }
    return null;
  }
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) {
    throwValidationError(`${fieldName} debe ser un entero positivo`);
  }
  return numeric;
};

const parseDecimal = (value, fieldName, { required = false } = {}) => {
  if (value === undefined) {
    if (required) {
      throwValidationError(`${fieldName} es obligatorio`);
    }
    return undefined;
  }
  if (value === null || value === '') {
    if (required) {
      throwValidationError(`${fieldName} es obligatorio`);
    }
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throwValidationError(`${fieldName} debe ser un número positivo`);
  }
  return Math.round(numeric * 100) / 100;
};

const parsePaginationValue = (value, fieldName, { defaultValue, max = 100 } = {}) => {
  if (value === undefined) return defaultValue;

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throwValidationError(`${fieldName} debe ser un entero positivo`);
  }

  return Math.min(numeric, max);
};

const parseOptionalTime = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'string') {
    throwValidationError(`${fieldName} debe ser una cadena en formato HH:MM`);
  }

  const normalized = normalizeHour(value);
  if (!normalized) {
    throwValidationError(`${fieldName} debe tener el formato HH:MM o HH:MM:SS`);
  }

  return normalized;
};

const parseRequiredString = (value, fieldName) => {
  const parsed = parseNullableString(value, fieldName);
  if (!parsed) {
    throwValidationError(`${fieldName} es obligatorio`);
  }
  return parsed;
};

const parseFecha = (value) => {
  if (value === undefined || value === null || value === '') {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throwValidationError('fecha inválida');
  }

  return parsed;
};

const parseBooleanLike = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'si', 'sí', 'on', 'yes'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  throwValidationError(`${fieldName} debe ser booleano`);
};

const parseEstadoCancha = (value, { required = false } = {}) => {
  if (value === undefined) {
    if (required) {
      throwValidationError('estado es obligatorio');
    }
    return undefined;
  }
  if (value === null || value === '') {
    if (required) {
      throwValidationError('estado es obligatorio');
    }
    return 'disponible';
  }
  if (!ESTADOS_CANCHA.has(value)) {
    throwValidationError('estado inválido');
  }
  return value;
};

const buildCanchaPayload = (body = {}, { partial = false } = {}) => {
  const payload = {};

  const nombre = parseNullableString(body.nombre, 'nombre');
  if (!partial || body.nombre !== undefined) {
    if (nombre === undefined || nombre === null || nombre === '') {
      throwValidationError('El nombre de la cancha es obligatorio');
    }
    payload.nombre = nombre;
  }

  if (!partial || body.deporte_id !== undefined) {
    const deporteId = parsePositiveInteger(body.deporte_id, 'deporte_id', { required: true });
    if (deporteId === null) {
      throwValidationError('deporte_id es obligatorio');
    }
    payload.deporte_id = deporteId;
  }

  if (!partial || body.capacidad !== undefined) {
    const capacidad = parsePositiveInteger(body.capacidad, 'capacidad', { required: true });
    payload.capacidad = capacidad === undefined ? null : capacidad;
  }

  const precioDiaProvided = body.precio_dia !== undefined;
  const precioNocheProvided = body.precio_noche !== undefined;

  if (!partial && !precioDiaProvided && !precioNocheProvided) {
    throwValidationError('Debe especificar al menos uno de precio_dia o precio_noche');
  }

  if (precioDiaProvided) {
    const precioDia = parseDecimal(body.precio_dia, 'precio_dia');
    if (precioDia !== undefined) {
      payload.precio_dia = precioDia;
    }
  }

  if (precioNocheProvided) {
    const precioNoche = parseDecimal(body.precio_noche, 'precio_noche');
    if (precioNoche !== undefined) {
      payload.precio_noche = precioNoche;
    }
  }

  const tipoSuelo = parseNullableString(body.tipo_suelo, 'tipo_suelo');
  if (tipoSuelo !== undefined) {
    payload.tipo_suelo = tipoSuelo;
  } else if (!partial) {
    payload.tipo_suelo = null;
  }

  const techada = parseBooleanLike(body.techada, 'techada');
  if (techada !== undefined) {
    payload.techada = techada;
  } else if (!partial) {
    payload.techada = false;
  }

  const iluminacion = parseBooleanLike(body.iluminacion, 'iluminacion');
  if (iluminacion !== undefined) {
    payload.iluminacion = iluminacion;
  } else if (!partial) {
    payload.iluminacion = false;
  }

  const estado = parseEstadoCancha(body.estado, { required: false });
  if (estado !== undefined) {
    payload.estado = estado;
  } else if (!partial) {
    payload.estado = 'disponible';
  }

  const imagenUrl = parseNullableString(body.imagen_url ?? body.imagen, 'imagen_url');
  if (imagenUrl !== undefined) {
    payload.imagen_url = imagenUrl;
  }

  return payload;
};

// ---------------- Mis datos
router.get('/mis-datos', (req, res) => {
  res.json(req.club);
});

router.post('/mis-datos/logo', uploadClubLogo, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: 'Debe adjuntar un archivo "logo"' });
    }

    const clubActualizado = await ClubesModel.actualizarPorId(req.club.club_id, {
      foto_logo: req.file.buffer,
    });

    req.club = clubActualizado;

    return res.json({ mensaje: 'Logo actualizado', club: clubActualizado });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.patch('/mis-datos', async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      foto_logo,
      provincia_id,
      localidad_id,
      telefono_contacto,
      email_contacto,
      precio_grabacion,
      direccion,
      latitud,
      longitud,
      google_place_id,
      hora_nocturna_inicio,
      hora_nocturna_fin,
    } = req.body || {};

    if (typeof nombre !== 'string' || nombre.trim() === '') {
      return res.status(400).json({ mensaje: 'El nombre es obligatorio' });
    }

    let provinciaIdValue = provincia_id;
    if (provincia_id !== undefined) {
      if (provincia_id === null || provincia_id === '') {
        provinciaIdValue = null;
      } else {
        const provinciaNumerica = Number(provincia_id);
        if (!Number.isInteger(provinciaNumerica)) {
          return res.status(400).json({ mensaje: 'provincia_id inválido' });
        }

        const existeProvincia = await ProvinciasModel.existe(provinciaNumerica);
        if (!existeProvincia) {
          return res.status(400).json({ mensaje: 'La provincia especificada no existe' });
        }

        provinciaIdValue = provinciaNumerica;
      }
    }

    let localidadIdValue = localidad_id;
    if (localidad_id !== undefined) {
      if (localidad_id === null || localidad_id === '') {
        localidadIdValue = null;
      } else {
        const localidadNumerica = Number(localidad_id);
        if (!Number.isInteger(localidadNumerica)) {
          return res.status(400).json({ mensaje: 'localidad_id inválido' });
        }

        const localidadExiste = await LocalidadesModel.existe(localidadNumerica);
        if (!localidadExiste) {
          return res.status(400).json({ mensaje: 'La localidad especificada no existe' });
        }

        localidadIdValue = localidadNumerica;
      }
    }

    const parseOptionalString = (value, fieldName) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== 'string') {
        throw new Error(`${fieldName} debe ser una cadena o null`);
      }
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    };

    let telefonoValue;
    try {
      telefonoValue = parseOptionalString(telefono_contacto, 'telefono_contacto');
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }
    if (telefonoValue !== undefined && telefonoValue !== null) {
      const phoneRegex = /^[+()0-9\s-]{6,25}$/;
      if (!phoneRegex.test(telefonoValue)) {
        return res.status(400).json({ mensaje: 'telefono_contacto inválido' });
      }
    }

    let emailValue;
    try {
      emailValue = parseOptionalString(email_contacto, 'email_contacto');
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }
    if (emailValue !== undefined && emailValue !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        return res.status(400).json({ mensaje: 'email_contacto inválido' });
      }
    }

    let precioGrabacionValue = precio_grabacion;
    if (precio_grabacion !== undefined) {
      if (precio_grabacion === null || precio_grabacion === '') {
        precioGrabacionValue = null;
      } else {
        const numeric = Number(precio_grabacion);
        if (!Number.isFinite(numeric) || numeric < 0) {
          return res.status(400).json({ mensaje: 'precio_grabacion inválido' });
        }
        precioGrabacionValue = numeric;
      }
    }

    let direccionValue;
    try {
      direccionValue = parseOptionalString(direccion, 'direccion');
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }

    let placeIdValue;
    try {
      placeIdValue = parseOptionalString(google_place_id, 'google_place_id');
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }

    const parseCoordinate = (value, fieldName, min, max) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        throw new Error(`${fieldName} inválida`);
      }
      if (numeric < min || numeric > max) {
        throw new Error(`${fieldName} fuera de rango`);
      }
      return numeric;
    };

    let latitudValue;
    let longitudValue;
    try {
      latitudValue = parseCoordinate(latitud, 'latitud', -90, 90);
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }
    try {
      longitudValue = parseCoordinate(longitud, 'longitud', -180, 180);
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }

    let horaNocturnaInicioValue;
    let horaNocturnaFinValue;
    try {
      horaNocturnaInicioValue = parseOptionalTime(hora_nocturna_inicio, 'hora_nocturna_inicio');
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }
    try {
      horaNocturnaFinValue = parseOptionalTime(hora_nocturna_fin, 'hora_nocturna_fin');
    } catch (e) {
      return res.status(400).json({ mensaje: e.message });
    }

    if (
      horaNocturnaInicioValue !== undefined &&
      horaNocturnaFinValue !== undefined &&
      horaNocturnaInicioValue !== null &&
      horaNocturnaFinValue !== null &&
      horaNocturnaInicioValue === horaNocturnaFinValue
    ) {
      return res.status(400).json({
        mensaje: 'hora_nocturna_inicio y hora_nocturna_fin no pueden ser iguales',
      });
    }

    if (localidadIdValue !== undefined && localidadIdValue !== null) {
      let provinciaParaValidar = req.club.provincia_id;
      if (provincia_id !== undefined) {
        provinciaParaValidar = provinciaIdValue;
      }

      if (provinciaParaValidar === null || provinciaParaValidar === undefined) {
        return res
          .status(400)
          .json({ mensaje: 'Debe especificar una provincia para asociar la localidad' });
      }

      const pertenece = await LocalidadesModel.perteneceAProvincia(
        localidadIdValue,
        provinciaParaValidar
      );

      if (!pertenece) {
        return res
          .status(400)
          .json({ mensaje: 'La localidad no pertenece a la provincia indicada' });
      }
    }

    const payload = {
      nombre,
    };

    if (descripcion !== undefined) payload.descripcion = descripcion;
    if (foto_logo !== undefined) payload.foto_logo = foto_logo;
    if (provincia_id !== undefined) payload.provincia_id = provinciaIdValue;
    if (localidad_id !== undefined) payload.localidad_id = localidadIdValue;
    if (telefono_contacto !== undefined) payload.telefono_contacto = telefonoValue;
    if (email_contacto !== undefined) payload.email_contacto = emailValue;
    if (precio_grabacion !== undefined) payload.precio_grabacion = precioGrabacionValue;
    if (direccion !== undefined) payload.direccion = direccionValue;
    if (latitud !== undefined) payload.latitud = latitudValue;
    if (longitud !== undefined) payload.longitud = longitudValue;
    if (google_place_id !== undefined) payload.google_place_id = placeIdValue;
    if (hora_nocturna_inicio !== undefined) payload.hora_nocturna_inicio = horaNocturnaInicioValue;
    if (hora_nocturna_fin !== undefined) payload.hora_nocturna_fin = horaNocturnaFinValue;

    const clubActualizado = await ClubesModel.actualizarPorId(req.club.club_id, payload);

    req.club = clubActualizado;

    res.json({ mensaje: 'Datos del club actualizados', club: clubActualizado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis servicios
router.get('/mis-servicios', async (req, res) => {
  try {
    const servicios = await ClubServiciosModel.listarPorClub(req.club.club_id);

    res.json({
      club_id: req.club.club_id,
      servicios: servicios.map((servicio) => ({
        ...servicio,
        seleccionado: Boolean(servicio.activo),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis gastos (CRUD)
router.get('/mis-gastos', async (req, res) => {
  try {
    const fechaReferencia = parseFecha(req.query.fecha);
    const limit = parsePaginationValue(req.query.limit, 'limit', { defaultValue: 20, max: 50 });
    const page = parsePaginationValue(req.query.page, 'page', { defaultValue: 1, max: 1000 });

    const { gastos, resumen, meta } = await GastosModel.listarPorMes(
      req.club.club_id,
      fechaReferencia,
      { limit, page }
    );
    res.json({ club_id: req.club.club_id, gastos, resumen, meta });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.post('/mis-gastos', async (req, res) => {
  try {
    const categoria = parseRequiredString(req.body.categoria, 'categoria');
    const descripcion = parseNullableString(req.body.descripcion, 'descripcion');
    const monto = parseDecimal(req.body.monto, 'monto', { required: true });
    const fecha = parseFecha(req.body.fecha);
    const icono = parseIcono(req.body.icono ?? req.body.icon);

    const gasto = await GastosModel.crear(req.club.club_id, {
      categoria,
      descripcion: descripcion === undefined ? null : descripcion,
      monto,
      fecha,
      icono,
    });

    res.status(201).json({ mensaje: 'Gasto registrado', gasto });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.put('/mis-gastos/:gasto_id', async (req, res) => {
  try {
    const gastoId = Number(req.params.gasto_id);
    if (!Number.isInteger(gastoId)) {
      return res.status(400).json({ mensaje: 'gasto_id inválido' });
    }

    const existente = await GastosModel.obtenerPorId(gastoId, req.club.club_id);
    if (!existente) {
      return res.status(404).json({ mensaje: 'Gasto no encontrado' });
    }

    const updates = {};
    if (req.body.categoria !== undefined) updates.categoria = parseRequiredString(req.body.categoria, 'categoria');
    if (req.body.descripcion !== undefined) updates.descripcion = parseNullableString(req.body.descripcion, 'descripcion');
    if (req.body.monto !== undefined) updates.monto = parseDecimal(req.body.monto, 'monto', { required: true });
    if (req.body.fecha !== undefined) updates.fecha = parseFecha(req.body.fecha);
    if (req.body.icono !== undefined || req.body.icon !== undefined) {
      updates.icono = parseIcono(req.body.icono ?? req.body.icon);
    }

    const gasto = await GastosModel.actualizar(gastoId, req.club.club_id, updates);
    res.json({ mensaje: 'Gasto actualizado', gasto });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.delete('/mis-gastos/:gasto_id', async (req, res) => {
  try {
    const gastoId = Number(req.params.gasto_id);
    if (!Number.isInteger(gastoId)) {
      return res.status(400).json({ mensaje: 'gasto_id inválido' });
    }

    const eliminado = await GastosModel.eliminar(gastoId, req.club.club_id);
    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Gasto no encontrado' });
    }

    res.json({ mensaje: 'Gasto eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.patch('/mis-servicios', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.servicio_ids) ? req.body.servicio_ids : null;
    if (!ids) {
      return res.status(400).json({ mensaje: 'Debe enviar servicio_ids como arreglo' });
    }

    const normalizados = [];
    for (const id of ids) {
      const numero = Number(id);
      if (!Number.isInteger(numero) || numero <= 0) {
        return res.status(400).json({ mensaje: 'Todos los servicio_ids deben ser enteros positivos' });
      }
      normalizados.push(numero);
    }

    const set = new Set(normalizados);
    if (set.size !== normalizados.length) {
      return res.status(400).json({ mensaje: 'servicio_ids contiene duplicados' });
    }
    if (normalizados.length > 10) {
      return res.status(400).json({ mensaje: 'Máximo 10 servicios por club' });
    }

    const catalogo = await ServiciosModel.listarPorIds(normalizados);
    if (catalogo.length !== normalizados.length) {
      const catalogoSet = new Set(catalogo.map((servicio) => servicio.servicio_id));
      const faltantes = normalizados.filter((id) => !catalogoSet.has(id));
      return res
        .status(400)
        .json({ mensaje: `Servicio ${faltantes[0]} inválido` });
    }

    await ClubServiciosModel.crearDesdeCatalogo(req.club.club_id, catalogo);
    await ClubServiciosModel.eliminarNoSeleccionados(req.club.club_id, normalizados);

    const servicios = await ClubServiciosModel.listarPorClub(req.club.club_id);

    res.json({
      mensaje: 'Servicios actualizados',
      servicios: servicios.map((servicio) => ({
        ...servicio,
        seleccionado: Boolean(servicio.activo),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis impuestos
router.get('/mis-impuestos', async (req, res) => {
  try {
    const impuestos = await ClubesImpuestosModel.listarSeleccionados(req.club.club_id);
    res.json({ club_id: req.club.club_id, impuestos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

router.patch('/mis-impuestos', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) {
      return res.status(400).json({ mensaje: 'Debe enviar items como arreglo' });
    }

    const normalizados = [];
    const nombresSet = new Set();

    for (const item of items) {
      const nombre = typeof item?.nombre === 'string' ? item.nombre.trim() : '';
      if (!nombre) {
        return res.status(400).json({ mensaje: 'Cada impuesto debe tener un nombre' });
      }

      const nombreKey = nombre.toLowerCase();
      if (nombresSet.has(nombreKey)) {
        return res.status(400).json({ mensaje: 'Los nombres de impuestos no pueden repetirse' });
      }
      nombresSet.add(nombreKey);

      const porcentajeNumber = Number(item?.porcentaje);
      if (!Number.isFinite(porcentajeNumber)) {
        return res.status(400).json({ mensaje: 'El porcentaje debe ser numérico' });
      }
      if (porcentajeNumber < 0 || porcentajeNumber > 100) {
        return res.status(400).json({ mensaje: 'El porcentaje debe estar entre 0 y 100' });
      }

      let descripcion = null;
      if (item?.descripcion !== undefined && item.descripcion !== null) {
        if (typeof item.descripcion !== 'string') {
          return res.status(400).json({ mensaje: 'La descripción debe ser una cadena' });
        }
        const trimmed = item.descripcion.trim();
        descripcion = trimmed === '' ? null : trimmed;
      }

      normalizados.push({
        nombre,
        porcentaje: Number(porcentajeNumber.toFixed(2)),
        descripcion,
      });
    }

    const impuestos = await ClubesImpuestosModel.reemplazarSeleccion(
      req.club.club_id,
      normalizados
    );

    res.json({ mensaje: 'Impuestos actualizados', impuestos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (listar)
router.get('/mis-canchas', async (req, res) => {
  try {
    const canchas = await ClubesModel.obtenerMisCanchas(req.club.club_id);
    res.json({ club: req.club, canchas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (crear)
router.post('/mis-canchas', async (req, res) => {
  try {
    const payload = buildCanchaPayload(req.body || {}, { partial: false });
    const cancha = await CanchasModel.crearCancha({
      ...payload,
      club_id: req.club.club_id,
    });

    res.status(201).json({ mensaje: 'Cancha creada', cancha });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (detalle)
router.get('/mis-canchas/:cancha_id', async (req, res) => {
  try {
    const canchaId = Number(req.params.cancha_id);
    if (!Number.isInteger(canchaId)) {
      return res.status(400).json({ mensaje: 'cancha_id inválido' });
    }

    const cancha = await CanchasModel.obtenerCanchaPorId(canchaId);
    if (!cancha || cancha.club_id !== req.club.club_id) {
      return res.status(404).json({ mensaje: 'Cancha no encontrada' });
    }

    res.json({ cancha });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (actualizar)
router.patch('/mis-canchas/:cancha_id', async (req, res) => {
  try {
    const canchaId = Number(req.params.cancha_id);
    if (!Number.isInteger(canchaId)) {
      return res.status(400).json({ mensaje: 'cancha_id inválido' });
    }

    const existente = await CanchasModel.obtenerCanchaPorId(canchaId);
    if (!existente || existente.club_id !== req.club.club_id) {
      return res.status(404).json({ mensaje: 'Cancha no encontrada' });
    }

    const payload = buildCanchaPayload(req.body || {}, { partial: true });
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ mensaje: 'Debe enviar al menos un campo a actualizar' });
    }

    const cancha = await CanchasModel.actualizarCancha(canchaId, payload);
    res.json({ mensaje: 'Cancha actualizada', cancha });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (eliminar)
router.delete('/mis-canchas/:cancha_id', async (req, res) => {
  try {
    const canchaId = Number(req.params.cancha_id);
    if (!Number.isInteger(canchaId)) {
      return res.status(400).json({ mensaje: 'cancha_id inválido' });
    }

    const existente = await CanchasModel.obtenerCanchaPorId(canchaId);
    if (!existente || existente.club_id !== req.club.club_id) {
      return res.status(404).json({ mensaje: 'Cancha no encontrada' });
    }

    await CanchasModel.eliminarCancha(canchaId);
    res.json({ mensaje: 'Cancha eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (imagen)
router.post('/mis-canchas/:cancha_id/imagen', uploadCanchaImagen, async (req, res) => {
  try {
    const canchaId = Number(req.params.cancha_id);
    if (!Number.isInteger(canchaId)) {
      return res.status(400).json({ mensaje: 'cancha_id inválido' });
    }

    const existente = await CanchasModel.obtenerCanchaPorId(canchaId);
    if (!existente || existente.club_id !== req.club.club_id) {
      return res.status(404).json({ mensaje: 'Cancha no encontrada' });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: 'Debe adjuntar un archivo "imagen"' });
    }

    await CanchasModel.actualizarImagen(canchaId, req.file);
    const cancha = await CanchasModel.obtenerCanchaPorId(canchaId);

    res.json({
      mensaje: 'Imagen actualizada',
      imagen_url: cancha ? cancha.imagen_url : null,
      cancha,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ mensaje: err.message });
    }
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis canchas (resumen)
router.get('/mis-canchas/:cancha_id/resumen', async (req, res) => {
  try {
    const canchaId = Number(req.params.cancha_id);
    if (!Number.isInteger(canchaId)) {
      return res.status(400).json({ mensaje: 'cancha_id inválido' });
    }

    const existente = await CanchasModel.obtenerCanchaPorId(canchaId);
    if (!existente || existente.club_id !== req.club.club_id) {
      return res.status(404).json({ mensaje: 'Cancha no encontrada' });
    }

    const resumen = await CanchasModel.obtenerResumen(canchaId);
    res.json({ resumen });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Público: info club + canchas
router.get('/publico/:club_id', async (req, res) => {
  try {
    const { club_id } = req.params;
    const club = await ClubesModel.obtenerClubPorId(club_id);
    if (!club) return res.status(404).json({ mensaje: 'Club no encontrado' });

    const canchas = await CanchasModel.listarPorClub(club_id);
    res.json({ club, canchas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Economía del club
router.get('/:club_id/economia', async (req, res) => {
  try {
    const { club_id } = req.params;
    const { semana } = req.query;
    const club = await ClubesModel.obtenerClubPorId(club_id);
    if (!club) return res.status(404).json({ mensaje: 'Club no encontrado' });

    const data = await ClubesModel.obtenerEconomia(club_id, { weekStart: semana });
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Resumen por club
router.get('/:club_id/resumen', async (req, res) => {
  try {
    const { club_id } = req.params;
    const club = await ClubesModel.obtenerClubPorId(club_id);
    if (!club) return res.status(404).json({ mensaje: 'Club no encontrado' });

    const data = await ClubesModel.obtenerResumen(club_id);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Panel club: reservas por cancha/fecha
router.get('/canchas/:cancha_id/reservas', async (req, res) => {
  try {
    const { cancha_id } = req.params;
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ mensaje: 'Parámetro "fecha" es requerido (YYYY-MM-DD)' });

    const esPropia = await CanchasModel.perteneceAClub(cancha_id, req.club.club_id);
    if (!esPropia) return res.status(403).json({ mensaje: 'No tienes permisos sobre esta cancha' });

    const reservas = await ReservasModel.reservasPorCanchaFecha(cancha_id, fecha);
    res.json({ cancha_id: Number(cancha_id), fecha, reservas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis horarios (listar)
router.get('/mis-horarios', async (req, res) => {
  try {
    const horarios = await ClubesHorarioModel.listarPorClub(req.club.club_id);
    res.json({ club_id: req.club.club_id, horarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis horarios (upsert por día)
router.patch('/mis-horarios', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items || items.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere items[] con horarios' });
    }

    for (const it of items) {
      const { dia_semana, abre, cierra, activo = 1 } = it || {};
      if (!Number.isInteger(dia_semana) || dia_semana < 1 || dia_semana > 7 || !abre || !cierra) {
        return res.status(400).json({ mensaje: 'Cada item debe incluir dia_semana(1..7), abre y cierra' });
      }
      await ClubesHorarioModel.upsertDia({ club_id: req.club.club_id, dia_semana, abre, cierra, activo });
    }

    const horarios = await ClubesHorarioModel.listarPorClub(req.club.club_id);
    res.json({ mensaje: 'Horarios actualizados', horarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis tarifas (listar)
router.get('/mis-tarifas', async (req, res) => {
  try {
    const dia = req.query.dia ? parseInt(req.query.dia, 10) : null;
    const tarifas = await TarifasModel.listarPorClub(
      req.club.club_id,
      Number.isInteger(dia) ? dia : null
    );
    res.json({ club_id: req.club.club_id, tarifas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// ---------------- Mis tarifas (upsert en bulk)
router.patch('/mis-tarifas', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ mensaje: 'Debes enviar items[]' });
    }

    await TarifasModel.upsertItems(req.club.club_id, items);
    const tarifas = await TarifasModel.listarPorClub(req.club.club_id);
    res.json({ mensaje: 'Tarifas actualizadas', tarifas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

module.exports = router;
