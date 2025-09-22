const isDevelopment = process.env.NODE_ENV === 'development';

const formatMessage = (level, messages) => {
  return [`[meClub][${level.toUpperCase()}]`, ...messages];
};

const logger = {
  info: (...messages) => {
    console.info(...formatMessage('info', messages));
  },
  warn: (...messages) => {
    console.warn(...formatMessage('warn', messages));
  },
  error: (...messages) => {
    console.error(...formatMessage('error', messages));
  },
  debug: (...messages) => {
    if (isDevelopment) {
      console.debug(...formatMessage('debug', messages));
    }
  },
};

module.exports = logger;
