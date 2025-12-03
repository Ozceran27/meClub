const db = require('../config/db');
const { normalizeLogoValue, prepareLogoValue } = require('../utils/logoStorage');
const { normalizeCourtImage } = require('../utils/courtImage');
const { normalizeHour } = require('../utils/datetime');
const { normalizarEstadoPago } = require('../constants/reservasEstados');
const GastosModel = require('./gastos.model');

const toNullableNumber = (value) => {
  if (value === undefined || value === null) return null;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const mapNullableTime = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Date) {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  const normalized = normalizeHour(String(value));
  return normalized;
};

const mapClubRow = (row) => {
  if (!row || typeof row !== 'object') return row;

  return {
    ...row,
    foto_logo: normalizeLogoValue(row.foto_logo),
    latitud: row.latitud === null ? null : toNullableNumber(row.latitud),
    longitud: row.longitud === null ? null : toNullableNumber(row.longitud),
    telefono_contacto:
      row.telefono_contacto === undefined ? null : row.telefono_contacto || null,
    email_contacto:
      row.email_contacto === undefined ? null : row.email_contacto || null,
    direccion: row.direccion === undefined ? null : row.direccion || null,
    google_place_id:
      row.google_place_id === undefined ? null : row.google_place_id || null,
    precio_grabacion:
      row.precio_grabacion === undefined || row.precio_grabacion === null
        ? null
        : toNullableNumber(row.precio_grabacion),
    hora_nocturna_inicio: mapNullableTime(row.hora_nocturna_inicio),
    hora_nocturna_fin: mapNullableTime(row.hora_nocturna_fin),
  };
};

const normalizeNullableTrimmedString = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} debe ser una cadena o null`);
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  return trimmed;
};

const normalizeNullableInteger = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    throw new Error(`${fieldName} debe ser numérico o null`);
  }

  return numeric;
};

const normalizeNullableFloat = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} debe ser numérico o null`);
  }

  return numeric;
};

const normalizeNullableTime = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  if (value instanceof Date) {
    return mapNullableTime(value);
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${fieldName} debe ser una hora en formato HH:MM o HH:MM:SS`);
  }

  const normalized = normalizeHour(String(value));
  if (!normalized) {
    throw new Error(`${fieldName} debe tener el formato HH:MM o HH:MM:SS`);
  }

  return normalized;
};

const ClubesModel = {
  crearClub: async ({
    nombre,
    descripcion,
    usuario_id,
    nivel_id = 1,
    foto_logo = null,
    foto_portada = null,
    provincia_id = null,
    localidad_id = null,
    telefono_contacto = null,
    email_contacto = null,
    precio_grabacion = null,
    direccion = null,
    latitud = null,
    longitud = null,
    google_place_id = null,
  }, connection = null) => {
    const { value: logoValue } = prepareLogoValue(foto_logo === undefined ? null : foto_logo);
    const descripcionValue = normalizeNullableTrimmedString(descripcion, 'descripcion');
    const telefonoValue = normalizeNullableTrimmedString(telefono_contacto, 'telefono_contacto');
    const emailValue = normalizeNullableTrimmedString(email_contacto, 'email_contacto');
    const precioGrabacionValue = normalizeNullableFloat(precio_grabacion, 'precio_grabacion');
    const direccionValue = normalizeNullableTrimmedString(direccion, 'direccion');
    const latitudValue = normalizeNullableFloat(latitud, 'latitud');
    const longitudValue = normalizeNullableFloat(longitud, 'longitud');
    const provinciaValue = normalizeNullableInteger(provincia_id, 'provincia_id');
    const localidadValue = normalizeNullableInteger(localidad_id, 'localidad_id');
    const placeIdValue = normalizeNullableTrimmedString(google_place_id, 'google_place_id');

    const executor = connection || db;
    const [result] = await executor.query(
      `INSERT INTO clubes
       (nombre, descripcion, telefono_contacto, email_contacto, precio_grabacion, direccion, latitud, longitud, google_place_id,
        usuario_id, nivel_id, foto_logo, foto_portada, provincia_id, localidad_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcionValue,
        telefonoValue,
        emailValue,
        precioGrabacionValue,
        direccionValue,
        latitudValue,
        longitudValue,
        placeIdValue,
        usuario_id,
        nivel_id,
        logoValue,
        foto_portada,
        provinciaValue,
        localidadValue,
      ]
    );

    return mapClubRow({
      club_id: result.insertId,
      nombre,
      descripcion: descripcionValue,
      usuario_id,
      nivel_id,
      foto_logo: logoValue,
      foto_portada,
      provincia_id: provinciaValue,
      localidad_id: localidadValue,
      telefono_contacto: telefonoValue,
      email_contacto: emailValue,
      precio_grabacion: precioGrabacionValue,
      direccion: direccionValue,
      latitud: latitudValue,
      longitud: longitudValue,
      google_place_id: placeIdValue,
    });
  },

  obtenerClubPorPropietario: async (usuario_id) => {
    const [rows] = await db.query('SELECT * FROM clubes WHERE usuario_id = ? LIMIT 1', [usuario_id]);
    return mapClubRow(rows[0] || null);
  },

  obtenerMisCanchas: async (club_id) => {
    const [rows] = await db.query(
      `SELECT c.cancha_id, c.club_id, c.nombre, c.deporte_id, c.capacidad, c.precio_dia,
              c.precio_noche, c.tipo_suelo, c.techada, c.iluminacion, c.estado, c.imagen_url,
              d.nombre AS deporte_nombre
       FROM canchas c
       LEFT JOIN deportes d ON d.deporte_id = c.deporte_id
       WHERE c.club_id = ?
       ORDER BY c.cancha_id DESC`,
      [club_id]
    );

    return rows.map((row) => ({
      cancha_id: row.cancha_id,
      club_id: row.club_id,
      nombre: row.nombre,
      deporte_id: row.deporte_id,
      deporte_nombre: row.deporte_nombre || null,
      capacidad: row.capacidad === null || row.capacidad === undefined ? null : Number(row.capacidad),
      precio_dia:
        row.precio_dia === null || row.precio_dia === undefined ? null : Number(row.precio_dia),
      precio_noche:
        row.precio_noche === null || row.precio_noche === undefined ? null : Number(row.precio_noche),
      precio:
        row.precio_dia === null || row.precio_dia === undefined
          ? row.precio_noche === null || row.precio_noche === undefined
            ? null
            : Number(row.precio_noche)
          : Number(row.precio_dia),
      tipo_suelo: row.tipo_suelo == null ? null : row.tipo_suelo,
      techada: !!row.techada,
      iluminacion: !!row.iluminacion,
      estado: row.estado || 'disponible',
      imagen_url: normalizeCourtImage(row.imagen_url),
    }));
  },

  obtenerClubPorId: async (club_id) => {
    const [rows] = await db.query(`SELECT * FROM clubes WHERE club_id = ?`, [club_id]);
    return mapClubRow(rows[0] || null);
  },

  listClubIds: async () => {
    const [rows] = await db.query('SELECT club_id FROM clubes');
    return rows
      .map((row) => Number(row.club_id))
      .filter((clubId) => Number.isInteger(clubId));
  },

  actualizarPorId: async (
    club_id,
    {
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
    } = {}
  ) => {
    const existente = await ClubesModel.obtenerClubPorId(club_id);
    if (!existente) {
      throw new Error('Club no encontrado');
    }

    const updates = [];
    const values = [];

    const setField = (fieldName, normalizedValue) => {
      if (normalizedValue === undefined) return;
      if (normalizedValue === null) {
        updates.push(`${fieldName} = NULL`);
      } else {
        updates.push(`${fieldName} = ?`);
        values.push(normalizedValue);
      }
    };

    setField('nombre', normalizeNullableTrimmedString(nombre, 'nombre'));
    setField('descripcion', normalizeNullableTrimmedString(descripcion, 'descripcion'));
    setField(
      'telefono_contacto',
      normalizeNullableTrimmedString(telefono_contacto, 'telefono_contacto')
    );
    setField('email_contacto', normalizeNullableTrimmedString(email_contacto, 'email_contacto'));
    setField('precio_grabacion', normalizeNullableFloat(precio_grabacion, 'precio_grabacion'));
    setField('direccion', normalizeNullableTrimmedString(direccion, 'direccion'));
    setField('google_place_id', normalizeNullableTrimmedString(google_place_id, 'google_place_id'));
    setField('hora_nocturna_inicio', normalizeNullableTime(hora_nocturna_inicio, 'hora_nocturna_inicio'));
    setField('hora_nocturna_fin', normalizeNullableTime(hora_nocturna_fin, 'hora_nocturna_fin'));

    if (foto_logo !== undefined) {
      const { value: logoValue, shouldUpdate } = prepareLogoValue(foto_logo);
      if (shouldUpdate) {
        if (logoValue === null) {
          updates.push('foto_logo = NULL');
        } else {
          updates.push('foto_logo = ?');
          values.push(logoValue);
        }
      }
    }

    setField('provincia_id', normalizeNullableInteger(provincia_id, 'provincia_id'));
    setField('localidad_id', normalizeNullableInteger(localidad_id, 'localidad_id'));
    setField('latitud', normalizeNullableFloat(latitud, 'latitud'));
    setField('longitud', normalizeNullableFloat(longitud, 'longitud'));

    if (updates.length === 0) {
      return existente;
    }

    const sql = `UPDATE clubes SET ${updates.join(', ')} WHERE club_id = ?`;
    values.push(club_id);

    await db.query(sql, values);

    const actualizado = await ClubesModel.obtenerClubPorId(club_id);

    return actualizado;
  },

  obtenerResumen: async (club_id) => {
    const [clubRows] = await db.query(
      `SELECT latitud, longitud FROM clubes WHERE club_id = ? LIMIT 1`,
      [club_id]
    );

    const clubCoords = clubRows?.[0] || {};
    const clubLat = Number.isFinite(Number(clubCoords.latitud)) ? Number(clubCoords.latitud) : null;
    const clubLon = Number.isFinite(Number(clubCoords.longitud)) ? Number(clubCoords.longitud) : null;

    const courtStatusPromise = db.query(
      `SELECT estado, COUNT(*) AS total
       FROM canchas
       WHERE club_id = ?
       GROUP BY estado`,
      [club_id]
    );

    const reservasHoyPromise = db.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ? AND r.fecha = CURDATE()`,
      [club_id]
    );

    const reservasSemanaPromise = db.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND YEARWEEK(r.fecha, 1) = YEARWEEK(CURDATE(), 1)`,
      [club_id]
    );

    const economiaMesPromise = db.query(
      `SELECT COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND DATE_FORMAT(r.fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [club_id]
    );

    const courtTypesPromise = db.query(
      `SELECT
          COALESCE(d.nombre, NULLIF(c.tipo_suelo, ''), 'Otro') AS etiqueta,
          COUNT(*) AS total
       FROM canchas c
       LEFT JOIN deportes d ON d.deporte_id = c.deporte_id
       WHERE c.club_id = ?
       GROUP BY etiqueta
       ORDER BY total DESC, etiqueta ASC`,
      [club_id]
    );

    const reservasPagadasFinalizadasHoyPromise = db.query(
      `SELECT
          SUM(CASE WHEN r.estado_pago = 'pagado' THEN 1 ELSE 0 END) AS pagadas,
          SUM(CASE WHEN r.estado = 'finalizada' THEN 1 ELSE 0 END) AS finalizadas
       FROM reservas r
       WHERE r.club_id = ? AND r.fecha = CURDATE()`,
      [club_id]
    );

    const reservasDiariasPromise = db.query(
      `SELECT
          DATE(r.fecha) AS fecha,
          COUNT(*) AS total,
          SUM(CASE WHEN r.estado_pago = 'pagado' THEN 1 ELSE 0 END) AS pagadas,
          SUM(CASE WHEN r.estado = 'finalizada' THEN 1 ELSE 0 END) AS finalizadas
       FROM reservas r
       WHERE r.club_id = ?
         AND r.fecha >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(r.fecha)
       ORDER BY fecha ASC`,
      [club_id]
    );

    const reservasMensualesPromise = db.query(
      `SELECT
          DATE_FORMAT(r.fecha, '%Y-%m') AS periodo,
          COUNT(*) AS total
       FROM reservas r
       WHERE r.club_id = ?
         AND r.fecha >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
       GROUP BY DATE_FORMAT(r.fecha, '%Y-%m')
       ORDER BY periodo ASC`,
      [club_id]
    );

    const [
      [courtStatusRows],
      [reservasHoyRows],
      [reservasSemanaRows],
      [economiaMesRows],
      [courtTypesRows],
      [reservasPagadasFinalizadasHoyRows],
      [reservasDiariasRows],
      [reservasMensualesRows],
    ] = await Promise.all([
      courtStatusPromise,
      reservasHoyPromise,
      reservasSemanaPromise,
      economiaMesPromise,
      courtTypesPromise,
      reservasPagadasFinalizadasHoyPromise,
      reservasDiariasPromise,
      reservasMensualesPromise,
    ]);

    const courtStatus = { disponible: 0, mantenimiento: 0, inactiva: 0 };
    courtStatusRows.forEach((row) => {
      if (row && row.estado && row.total !== undefined) {
        courtStatus[row.estado] = Number(row.total) || 0;
      }
    });

    const courtsAvailable = courtStatus.disponible || 0;
    const courtsMaintenance = courtStatus.mantenimiento || 0;
    const courtsInactive = courtStatus.inactiva || 0;

    const reservasHoy = Number(reservasHoyRows?.[0]?.total) || 0;
    const reservasSemana = Number(reservasSemanaRows?.[0]?.total) || 0;
    const economiaMes = Number(economiaMesRows?.[0]?.total) || 0;

    const courtTypes = (courtTypesRows || []).map((row) => ({
      etiqueta: row?.etiqueta || 'Otro',
      total: Number(row?.total) || 0,
    }));

    const reservasPagadasHoy = Number(reservasPagadasFinalizadasHoyRows?.[0]?.pagadas) || 0;
    const reservasFinalizadasHoy =
      Number(reservasPagadasFinalizadasHoyRows?.[0]?.finalizadas) || 0;

    const reservasDiarias = (reservasDiariasRows || []).map((row) => ({
      fecha:
        row?.fecha instanceof Date
          ? row.fecha.toISOString().slice(0, 10)
          : String(row?.fecha || ''),
      total: Number(row?.total) || 0,
      pagadas: Number(row?.pagadas) || 0,
      finalizadas: Number(row?.finalizadas) || 0,
    }));

    const reservasMensuales = (reservasMensualesRows || []).map((row) => ({
      periodo: String(row?.periodo || ''),
      total: Number(row?.total) || 0,
    }));

    const mesActual = new Date();
    const periodoActual = `${mesActual.getFullYear()}-${String(mesActual.getMonth() + 1).padStart(2, '0')}`;
    const reservasMesActual =
      reservasMensuales.find((row) => row.periodo === periodoActual)?.total || 0;

    const weatherResponse = await fetchCurrentWeather({
      latitud: clubLat,
      longitud: clubLon,
    });

    return {
      courtsAvailable,
      courtsMaintenance,
      courtsInactive,
      reservasHoy,
      reservasSemana,
      economiaMes,
      courtTypes,
      reservasPagadasHoy,
      reservasFinalizadasHoy,
      reservasDiarias,
      reservasMensuales,
      reservasMesActual,
      weatherStatus: weatherResponse.status,
      weatherTemp: weatherResponse.temperature,
    };
  },

  obtenerEconomia: async (club_id, { weekStart } = {}) => {
    const monthsBack = 6;
    const monthRangeStart = new Date();
    monthRangeStart.setDate(1);
    monthRangeStart.setMonth(monthRangeStart.getMonth() - (monthsBack - 1));

    const ingresosMensualesPromise = db.query(
      `SELECT r.estado_pago, COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND DATE_FORMAT(r.fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
       GROUP BY r.estado_pago`,
      [club_id]
    );

    const ingresosSemanalesPromise = db.query(
      `SELECT r.estado_pago, COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND YEARWEEK(r.fecha, 1) = YEARWEEK(?, 1)
       GROUP BY r.estado_pago`,
      [club_id, weekStart || new Date()]
    );

    const ingresosSemanalesSeriePromise = db.query(
      `SELECT YEARWEEK(r.fecha, 1) AS semana,
              DATE_SUB(DATE(r.fecha), INTERVAL WEEKDAY(r.fecha) DAY) AS fecha_inicio,
              DATE_ADD(DATE_SUB(DATE(r.fecha), INTERVAL WEEKDAY(r.fecha) DAY), INTERVAL 6 DAY) AS fecha_fin,
              r.estado_pago,
              COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND r.fecha >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
       GROUP BY semana, fecha_inicio, fecha_fin, r.estado_pago
       ORDER BY fecha_inicio DESC`,
      [club_id]
    );

    const reservasMensualesPromise = db.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND DATE_FORMAT(r.fecha, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [club_id]
    );

    const reservasSemanalesPromise = db.query(
      `SELECT COUNT(*) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND YEARWEEK(r.fecha, 1) = YEARWEEK(CURDATE(), 1)`,
      [club_id]
    );

    const gastosMensualesPromise = GastosModel.obtenerTotalMes(club_id);

    const ingresosHistoricosPromise = db.query(
      `SELECT DATE_FORMAT(r.fecha, '%Y-%m') AS periodo, r.estado_pago, COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND r.fecha >= ?
       GROUP BY DATE_FORMAT(r.fecha, '%Y-%m'), r.estado_pago
       ORDER BY periodo ASC`,
      [club_id, monthRangeStart]
    );

    const gastosHistoricosPromise = db.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m') AS periodo, COALESCE(SUM(monto), 0) AS total
       FROM gastos
       WHERE club_id = ?
         AND fecha >= ?
       GROUP BY DATE_FORMAT(fecha, '%Y-%m')
       ORDER BY periodo ASC`,
      [club_id, monthRangeStart]
    );

    const ingresosDiariosPromise = db.query(
      `SELECT DATE(r.fecha) AS fecha, r.estado_pago, COALESCE(SUM(r.monto), 0) AS total
       FROM reservas r
       JOIN canchas c ON c.cancha_id = r.cancha_id
       WHERE c.club_id = ?
         AND r.fecha >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(r.fecha), r.estado_pago
       ORDER BY fecha ASC`,
      [club_id]
    );

    const [
      [ingresosMensualesRows],
      [ingresosSemanalesRows],
      [ingresosSemanalesSerieRows],
      [reservasMensualesRows],
      [reservasSemanalesRows],
      gastosMensuales,
      [ingresosHistoricosRows],
      [gastosHistoricosRows],
      [ingresosDiariosRows],
    ] = await Promise.all([
      ingresosMensualesPromise,
      ingresosSemanalesPromise,
      ingresosSemanalesSeriePromise,
      reservasMensualesPromise,
      reservasSemanalesPromise,
      gastosMensualesPromise,
      ingresosHistoricosPromise,
      gastosHistoricosPromise,
      ingresosDiariosPromise,
    ]);

    const estadosBase = { pagado: 0, senado: 0, pendiente_pago: 0 };

    const acumularIngresos = (rows = []) =>
      rows.reduce(
        (acc, row) => {
          const estado = normalizarEstadoPago(row?.estado_pago) || 'pendiente_pago';
          const total = row?.total === null || row?.total === undefined ? 0 : Number(row.total);
          if (acc[estado] === undefined) acc[estado] = 0;
          acc[estado] += total;
          return acc;
        },
        { ...estadosBase }
      );

    const ingresosMes = acumularIngresos(ingresosMensualesRows);
    const ingresosSemana = acumularIngresos(ingresosSemanalesRows);

    const reservasMes = Number(reservasMensualesRows?.[0]?.total) || 0;
    const reservasSemana = Number(reservasSemanalesRows?.[0]?.total) || 0;

    const proyeccionMes = Object.values(ingresosMes).reduce((acc, val) => acc + val, 0);
    const proyeccionSemana = Object.values(ingresosSemana).reduce((acc, val) => acc + val, 0);

    const balanceMensual = proyeccionMes - gastosMensuales;

    const ingresosSemanalesSerie = (() => {
      const acumuladoPorSemana = (ingresosSemanalesSerieRows || []).reduce((acc, row) => {
        const semanaKey = row?.fecha_inicio
          ? new Date(row.fecha_inicio).toISOString().slice(0, 10)
          : row?.semana;

        if (!semanaKey) return acc;

        const estado = normalizarEstadoPago(row?.estado_pago) || 'pendiente_pago';
        const total = row?.total === null || row?.total === undefined ? 0 : Number(row.total);
        const fechaInicio = row?.fecha_inicio ? new Date(row.fecha_inicio) : null;
        const fechaFin = row?.fecha_fin ? new Date(row.fecha_fin) : null;
        const numeroSemana = row?.semana ? Number(String(row.semana).slice(-2)) : null;

        if (!acc[semanaKey]) {
          acc[semanaKey] = {
            semana: numeroSemana,
            fecha_inicio: fechaInicio ? fechaInicio.toISOString().slice(0, 10) : null,
            fecha_fin: fechaFin ? fechaFin.toISOString().slice(0, 10) : null,
            ...estadosBase,
          };
        }

        acc[semanaKey][estado] = (acc[semanaKey][estado] || 0) + total;
        return acc;
      }, {});

      const semanasOrdenadas = Object.values(acumuladoPorSemana).sort((a, b) => {
        const fechaA = a?.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
        const fechaB = b?.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
        return fechaA - fechaB;
      });

      const ultimasSemanas = semanasOrdenadas.slice(-7).map((item, index, arr) => {
        const labelSemana =
          Number.isInteger(item?.semana) && item.semana > 0
            ? `S${String(item.semana).padStart(2, '0')}`
            : `S${arr.length - index}`;

        const pagado = item?.pagado || 0;
        const senado = item?.senado || 0;
        const pendiente_pago = item?.pendiente_pago || 0;

        return {
          ...item,
          label: labelSemana,
          total: pagado + senado + pendiente_pago,
        };
      });

      return ultimasSemanas;
    })();

    const monthTimeline = Array.from({ length: monthsBack }, (_, index) => {
      const current = new Date(monthRangeStart);
      current.setMonth(monthRangeStart.getMonth() + index);
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    });

    const ingresosPorPeriodo = ingresosHistoricosRows.reduce((acc, row) => {
      const periodo = row?.periodo;
      if (!periodo) return acc;
      const estado = normalizarEstadoPago(row?.estado_pago) || 'pendiente_pago';
      if (!acc[periodo]) acc[periodo] = { ...estadosBase };
      acc[periodo][estado] = (acc[periodo][estado] || 0) + (Number(row?.total) || 0);
      return acc;
    }, {});

    const gastosPorPeriodo = gastosHistoricosRows.reduce((acc, row) => {
      const periodo = row?.periodo;
      if (!periodo) return acc;
      acc[periodo] = (acc[periodo] || 0) + (Number(row?.total) || 0);
      return acc;
    }, {});

    const economiaMensual = monthTimeline.map((periodo) => {
      const ingresosPeriodo = ingresosPorPeriodo[periodo] || { ...estadosBase };
      const gastosPeriodo = gastosPorPeriodo[periodo] || 0;
      const ingresosTotales = Object.values(ingresosPeriodo).reduce((acc, val) => acc + val, 0);
      return {
        periodo,
        ingresos: ingresosPeriodo,
        gastos: gastosPeriodo,
        balance: ingresosTotales - gastosPeriodo,
      };
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSevenDays = Array.from({ length: 7 }, (_, idx) => {
      const current = new Date(today);
      current.setDate(today.getDate() - (6 - idx));
      current.setHours(0, 0, 0, 0);
      return current;
    });

    const ingresosDiariosAcumulados = (ingresosDiariosRows || []).reduce((acc, row) => {
      const fecha =
        row?.fecha instanceof Date
          ? row.fecha.toISOString().slice(0, 10)
          : row?.fecha?.toString?.().slice(0, 10);
      if (!fecha) return acc;

      const estado = normalizarEstadoPago(row?.estado_pago) || 'pendiente_pago';
      const total = row?.total === null || row?.total === undefined ? 0 : Number(row.total);

      if (!acc[fecha]) acc[fecha] = { ...estadosBase, fecha };
      acc[fecha][estado] = (acc[fecha][estado] || 0) + total;
      return acc;
    }, {});

    const ingresosDiarios = lastSevenDays.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const breakdown = ingresosDiariosAcumulados[key] || { ...estadosBase, fecha: key };
      const pagado = breakdown.pagado || 0;
      const senado = breakdown.senado || 0;
      const pendiente_pago = breakdown.pendiente_pago || 0;

      return {
        fecha: key,
        pagado,
        senado,
        pendiente_pago,
        total: pagado + senado + pendiente_pago,
      };
    });

    const ingresosDiariosTotal =
      (ingresosDiariosAcumulados[today.toISOString().slice(0, 10)]?.pagado || 0) +
      (ingresosDiariosAcumulados[today.toISOString().slice(0, 10)]?.senado || 0);

    const ingresosDiariosUltimos7Dias = ingresosDiarios.reduce(
      (acc, item) => acc + (item.pagado || 0) + (item.senado || 0),
      0
    );

    const semanaSeleccionada = {
      start: lastSevenDays[0].toISOString().slice(0, 10),
      end: lastSevenDays[lastSevenDays.length - 1].toISOString().slice(0, 10),
    };

    return {
      ingresos: {
        mes: ingresosMes,
        semana: ingresosSemana,
      },
      ingresosSemanalesSerie,
      reservas: { mes: reservasMes, semana: reservasSemana },
      proyeccion: { mes: proyeccionMes, semana: proyeccionSemana },
      gastos: { mes: gastosMensuales },
      balanceMensual,
      ingresosMensualesHistoricos: economiaMensual.map((item) => ({
        periodo: item.periodo,
        total: Object.values(item.ingresos).reduce((acc, val) => acc + val, 0),
      })),
      economiaMensual,
      ingresosDiarios,
      ingresosDiariosTotal,
      ingresosDiariosUltimos7Dias,
      semanaSeleccionada,
    };
  },
};

async function fetchCurrentWeather({ latitud, longitud }) {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    return { status: null, temperature: null };
  }

  const weatherCodeMap = {
    0: 'Despejado',
    1: 'Mayormente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Niebla',
    48: 'Niebla con escarcha',
    51: 'Llovizna ligera',
    53: 'Llovizna moderada',
    55: 'Llovizna intensa',
    61: 'Lluvia débil',
    63: 'Lluvia moderada',
    65: 'Lluvia intensa',
    71: 'Nieve ligera',
    73: 'Nieve moderada',
    75: 'Nieve intensa',
    77: 'Granos de nieve',
    80: 'Chubascos ligeros',
    81: 'Chubascos moderados',
    82: 'Chubascos intensos',
    95: 'Tormenta',
    96: 'Tormenta con granizo ligero',
    99: 'Tormenta con granizo fuerte',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitud);
    url.searchParams.set('longitude', longitud);
    url.searchParams.set('current', 'temperature_2m,weather_code');

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      return { status: null, temperature: null };
    }

    const body = await res.json();
    const temp = Number(body?.current?.temperature_2m);
    const code = Number(body?.current?.weather_code);

    return {
      status: weatherCodeMap[code] || null,
      temperature: Number.isFinite(temp) ? Math.round(temp) : null,
    };
  } catch (err) {
    console.warn('Weather fetch error', err?.message || err);
    return { status: null, temperature: null };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = ClubesModel;
