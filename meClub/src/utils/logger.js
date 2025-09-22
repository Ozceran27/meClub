const isDevelopment = process.env.NODE_ENV === 'development';

export const debug = (...messages) => {
  if (isDevelopment) {
    console.debug('[meClub][DEBUG]', ...messages);
  }
};

export const info = (...messages) => {
  console.info('[meClub][INFO]', ...messages);
};

export const warn = (...messages) => {
  console.warn('[meClub][WARN]', ...messages);
};

export const error = (...messages) => {
  console.error('[meClub][ERROR]', ...messages);
};

const logger = { debug, info, warn, error };

export default logger;
