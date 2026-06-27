const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m',
  success: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (msg) => console.log(`${colors.info}[${timestamp()}] INFO:${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.success}[${timestamp()}] SUCCESS:${colors.reset} ${msg}`),
  warn: (msg) => console.warn(`${colors.warn}[${timestamp()}] WARN:${colors.reset} ${msg}`),
  error: (msg, err) => {
    console.error(`${colors.error}[${timestamp()}] ERROR:${colors.reset} ${msg}`);
    if (err) console.error(err);
  },
};

module.exports = logger;
