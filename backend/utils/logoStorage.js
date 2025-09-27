const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '..', 'uploads', 'logos');
const logosPublicPath = '/uploads/logos';

fs.mkdirSync(logosDir, { recursive: true });

const removeLogoByFilename = async (filename) => {
  if (!filename) return;
  const safeName = path.basename(filename);
  const absolutePath = path.join(logosDir, safeName);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error eliminando logo', absolutePath, err);
    }
  }
};

const removeLogoByStoredPath = async (storedPath = '') => {
  if (!storedPath || storedPath.startsWith('http')) return;
  const normalized = storedPath.split('?')[0];
  if (!normalized.startsWith(logosPublicPath)) return;
  const filename = path.posix.basename(normalized);
  await removeLogoByFilename(filename);
};

const ASCII_SAFE_REGEX = /^[\x20-\x7E]+$/;
const PATH_LIKE_REGEX = /^(?:\/?uploads\/logos|https?:\/\/|\/)/i;

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

const normalizeLogoValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (!Buffer.isBuffer(value)) return null;
  if (value.length === 0) return null;

  const asciiCandidate = value.toString('utf8');
  if (asciiCandidate && ASCII_SAFE_REGEX.test(asciiCandidate)) {
    const trimmed = asciiCandidate.trim();
    if (trimmed && PATH_LIKE_REGEX.test(trimmed)) {
      return trimmed;
    }
  }

  return bufferToDataUri(value);
};

const prepareLogoValue = (value) => {
  if (value === undefined) {
    return { shouldUpdate: false, value: null };
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
    return { shouldUpdate: true, value: trimmed };
  }
  if (value && typeof value === 'object' && Buffer.isBuffer(value.buffer)) {
    return { shouldUpdate: true, value: value.buffer };
  }
  throw new Error('foto_logo debe ser una cadena, Buffer o null');
};

module.exports = {
  logosDir,
  logosPublicPath,
  removeLogoByFilename,
  removeLogoByStoredPath,
  detectMimeType,
  bufferToDataUri,
  normalizeLogoValue,
  prepareLogoValue,
};
