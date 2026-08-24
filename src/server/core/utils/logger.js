let envLogLevel = process.env.TWIKOO_LOG_LEVEL || 'info'
envLogLevel = envLogLevel.toLowerCase()
const logLevel = { verbose: 1, info: 2, warn: 3, error: 4 }[envLogLevel] || 2

const logger = {
  log: (...messages) => {
    if (logLevel <= 1) console.log(logPrefix(), ...messages)
  },
  info: (...messages) => {
    if (logLevel <= 2) console.info(logPrefix(), ...messages)
  },
  warn: (...messages) => {
    if (logLevel <= 3) console.warn(logPrefix(), ...messages)
  },
  error: (...messages) => {
    if (logLevel <= 4) console.error(logPrefix(), ...messages)
  }
}

const logPrefix = () => `${new Date().toLocaleString()} Twikoo:`

module.exports = logger
