/**
 * Audit logger with JSON Lines format
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs-extra');

class AuditLogger {
  constructor(config) {
    this.config = config;
    this.logPath = config.audit?.log_path || '/var/log/mc-backup';
    
    // Ensure log directory exists
    this.ensureLogDirectory();
    
    // Create Winston logger
    this.logger = this.createLogger();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    try {
      fs.ensureDirSync(this.logPath);
    } catch (error) {
      console.error('Failed to create log directory:', error.message);
      // Fallback to current directory
      this.logPath = './logs';
      fs.ensureDirSync(this.logPath);
    }
  }

  /**
   * Create Winston logger instance
   */
  createLogger() {
    const jsonFormat = winston.format.printf(({ timestamp, level, action, triggered_by, details, result, ...rest }) => {
      return JSON.stringify({
        timestamp,
        level,
        action,
        triggered_by,
        details,
        result,
        ...rest
      });
    });

    return winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        jsonFormat
      ),
      transports: [
        // Daily rotating file transport
        new DailyRotateFile({
          filename: path.join(this.logPath, 'audit-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '100m',
          maxFiles: `${this.config.audit?.retention_days || 90}d`,
          compress: true,
          zippedArchive: true
        }),
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Log an event
   * @param {string} level - Log level (info, warn, error)
   * @param {string} action - Event type
   * @param {string} triggeredBy - Who/what triggered the event
   * @param {object} details - Event details
   * @param {string} result - success or failure
   */
  log(level, action, triggeredBy, details = {}, result = 'success') {
    this.logger.log({
      level,
      action,
      triggered_by: triggeredBy,
      details,
      result
    });
  }

  /**
   * Log info event
   */
  info(action, triggeredBy, details, result = 'success') {
    this.log('info', action, triggeredBy, details, result);
  }

  /**
   * Log warning event
   */
  warn(action, triggeredBy, details, result = 'warning') {
    this.log('warn', action, triggeredBy, details, result);
  }

  /**
   * Log error event
   */
  error(action, triggeredBy, details, result = 'failure') {
    this.log('error', action, triggeredBy, details, result);
  }

  /**
   * Log backup started
   */
  logBackupStarted(triggeredBy, details) {
    this.info('BACKUP_STARTED', triggeredBy, details);
  }

  /**
   * Log backup completed
   */
  logBackupCompleted(triggeredBy, details) {
    this.info('BACKUP_COMPLETED', triggeredBy, details, 'success');
  }

  /**
   * Log backup failed
   */
  logBackupFailed(triggeredBy, details) {
    this.error('BACKUP_FAILED', triggeredBy, details, 'failure');
  }

  /**
   * Log restore initiated
   */
  logRestoreInitiated(triggeredBy, details) {
    this.info('RESTORE_INITIATED', triggeredBy, details);
  }

  /**
   * Log restore completed
   */
  logRestoreCompleted(triggeredBy, details) {
    this.info('RESTORE_COMPLETED', triggeredBy, details, 'success');
  }

  /**
   * Log restore failed
   */
  logRestoreFailed(triggeredBy, details) {
    this.error('RESTORE_FAILED', triggeredBy, details, 'failure');
  }

  /**
   * Log server control events
   */
  logServerControl(action, triggeredBy, details, result = 'success') {
    this.info(action, triggeredBy, details, result);
  }

  /**
   * Log offsite sync events
   */
  logOffsiteSync(action, triggeredBy, details, result = 'success') {
    this.info(action, triggeredBy, details, result);
  }

  /**
   * Log cleanup events
   */
  logCleanup(triggeredBy, details) {
    this.info('CLEANUP_EXECUTED', triggeredBy, details);
  }

  /**
   * Log storage alerts
   */
  logStorageAlert(level, triggeredBy, details) {
    const action = level === 'warning' ? 'STORAGE_WARNING' : 'STORAGE_CRITICAL';
    this[level](action, triggeredBy, details);
  }

  /**
   * Log configuration changes
   */
  logConfigChange(triggeredBy, details) {
    this.info('CONFIG_CHANGED', triggeredBy, details);
  }

  /**
   * Log Discord commands
   */
  logDiscordCommand(command, user, details, result = 'success') {
    this.info('DISCORD_COMMAND', `discord:${user}`, { command, ...details }, result);
  }

  /**
   * Log API errors
   */
  logApiError(triggeredBy, details) {
    this.error('API_ERROR', triggeredBy, details);
  }

  /**
   * Log service lifecycle events
   */
  logServiceEvent(action, details = {}) {
    this.info(action, 'system', details);
  }
}

// Singleton instance
let instance = null;

module.exports = {
  init: (config) => {
    if (!instance) {
      instance = new AuditLogger(config);
    }
    return instance;
  },
  getInstance: () => instance,
  // Export methods for direct use
  info: (...args) => instance?.info(...args),
  warn: (...args) => instance?.warn(...args),
  error: (...args) => instance?.error(...args),
  logBackupStarted: (...args) => instance?.logBackupStarted(...args),
  logBackupCompleted: (...args) => instance?.logBackupCompleted(...args),
  logBackupFailed: (...args) => instance?.logBackupFailed(...args),
  logRestoreInitiated: (...args) => instance?.logRestoreInitiated(...args),
  logRestoreCompleted: (...args) => instance?.logRestoreCompleted(...args),
  logRestoreFailed: (...args) => instance?.logRestoreFailed(...args),
  logServerControl: (...args) => instance?.logServerControl(...args),
  logOffsiteSync: (...args) => instance?.logOffsiteSync(...args),
  logCleanup: (...args) => instance?.logCleanup(...args),
  logStorageAlert: (...args) => instance?.logStorageAlert(...args),
  logConfigChange: (...args) => instance?.logConfigChange(...args),
  logDiscordCommand: (...args) => instance?.logDiscordCommand(...args),
  logApiError: (...args) => instance?.logApiError(...args),
  logServiceEvent: (...args) => instance?.logServiceEvent(...args)
};
