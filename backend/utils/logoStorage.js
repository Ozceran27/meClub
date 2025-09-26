const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '..', 'uploads', 'logos');
const logosPublicPath = '/uploads/logos';

fs.mkdirSync(logosDir, { recursive: true });

const buildLogoPublicPath = (filename) => `${logosPublicPath}/${filename}`;

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

module.exports = {
  logosDir,
  logosPublicPath,
  buildLogoPublicPath,
  removeLogoByFilename,
  removeLogoByStoredPath,
};
