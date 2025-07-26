/*
  Logger with static background labels for different log levels.
*/

import chalk from 'chalk';

const prefix = '┃';

/**
 * Logger class with simple colored labels
 */
class Logger {
  /**
   * Log with style using the prefix and colored level
   */
  _logWithStyle(level, message) {
    let color;
    switch (level) {
      case 'INFO':
        color = chalk.blue;
        break;
      case 'WARN':
        color = chalk.yellow;
        break;
      case 'ERROR':
        color = chalk.red;
        break;
      case 'SUCCESS':
        color = chalk.green;
        break;
      case 'DEBUG':
        color = chalk.magenta;
        break;
      default:
        color = chalk.white;
    }

    console.log(`${chalk.gray(prefix)} ${color(level.padEnd(8))} ${message}`);
  }

  /**
   * Log info message
   */
  info(message) {
    this._logWithStyle('INFO', message);
  }

  /**
   * Log warning message
   */
  warn(message) {
    this._logWithStyle('WARN', message);
  }

  /**
   * Log error message
   */
  error(message) {
    this._logWithStyle('ERROR', message);
  }

  /**
   * Log success message
   */
  success(message) {
    this._logWithStyle('SUCCESS', message);
  }

  /**
   * Log debug message
   */
  debug(message) {
    this._logWithStyle('DEBUG', message);
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;