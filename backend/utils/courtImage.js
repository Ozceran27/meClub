const ASCII_SAFE_REGEX = /^[\x20-\x7E]+$/;
const PATH_LIKE_REGEX = /^(?:\/?uploads\/canchas|https?:\/\/|\/)/i;
const DATA_URI_REGEX = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/i;
const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;

const formatError = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

const detectMimeType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return 'application/octet-stream';
};

const bufferToDataUri = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return null;
  }
  const mime = detectMimeType(buffer) || 'application/octet-stream';
  return `data:${mime};base64,${buffer.toString('base64')}`;
};

const tryDecodeBase64 = (value) => {
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 16 || compact.length % 4 !== 0) {
    return null;
  }
  if (!BASE64_REGEX.test(compact)) {
    return null;
  }
  try {
    const decoded = Buffer.from(compact, 'base64');
    return decoded.length > 0 ? decoded : null;
  } catch (_err) {
    return null;
  }
};

const dataUriToBuffer = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(DATA_URI_REGEX);
  if (!match) return null;
  const base64Part = match[2].replace(/\s+/g, '');
  try {
    const buffer = Buffer.from(base64Part, 'base64');
    return buffer.length > 0 ? buffer : null;
  } catch (_err) {
    return null;
  }
};

const normalizeCourtImage = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (!Buffer.isBuffer(value) || value.length === 0) {
    return null;
  }

  const asciiCandidate = value.toString('utf8');
  if (asciiCandidate && ASCII_SAFE_REGEX.test(asciiCandidate)) {
    const trimmed = asciiCandidate.trim();
    if (trimmed && PATH_LIKE_REGEX.test(trimmed)) {
      return trimmed;
    }
  }

  return bufferToDataUri(value);
};

const prepareCourtImage = (value) => {
  if (value === undefined) {
    return { shouldUpdate: false, value: undefined };
  }
  if (value === null) {
    return { shouldUpdate: true, value: null };
  }
  if (Buffer.isBuffer(value)) {
    return { shouldUpdate: true, value };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return { shouldUpdate: true, value: null };
    }

    const dataUriBuffer = dataUriToBuffer(trimmed);
    if (dataUriBuffer) {
      return { shouldUpdate: true, value: dataUriBuffer };
    }

    if (PATH_LIKE_REGEX.test(trimmed) && ASCII_SAFE_REGEX.test(trimmed)) {
      return { shouldUpdate: true, value: trimmed };
    }

    const base64Buffer = tryDecodeBase64(trimmed);
    if (base64Buffer) {
      return { shouldUpdate: true, value: base64Buffer };
    }

    throw formatError('imagen_url contiene un formato no soportado');
  }
  if (value && typeof value === 'object' && Buffer.isBuffer(value.buffer)) {
    return { shouldUpdate: true, value: value.buffer };
  }
  throw formatError('imagen_url debe ser una cadena, Buffer o null');
};

module.exports = {
  detectMimeType,
  bufferToDataUri,
  dataUriToBuffer,
  normalizeCourtImage,
  prepareCourtImage,
};
