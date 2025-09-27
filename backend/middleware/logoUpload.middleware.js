const multer = require('multer');

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Formato de imagen no soportado (PNG, JPG o WEBP)'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter,
});

const buildSingleUploadMiddleware = (fieldName = 'logo') => (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return next();
  }

  const handler = upload.single(fieldName);
  handler(req, res, (err) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ mensaje: 'El logo supera el máximo de 2MB' });
      }
      return res.status(400).json({ mensaje: err.message || 'Error al subir el archivo' });
    }

    return res.status(400).json({ mensaje: err.message || 'Error al subir el archivo' });
  });
};

module.exports = {
  buildSingleUploadMiddleware,
  upload,
  ALLOWED_MIME_TYPES,
};
