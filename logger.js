/*
  Logger with gradient background labels for different log levels.
  Made by chatgpt (im lazy thx)
*/

import chalk from 'chalk';

/**
 * Blend two RGB colors
 */
function blendColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

/**
 * Create a string with gradient background and white text over it.
 */
function gradientBackgroundLabel(text, colors) {
  const length = text.length;
  const segments = colors.length - 1;
  let result = '';

  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const start = Math.floor(t * segments);
    const end = Math.min(start + 1, segments);
    const localT = (t * segments) - start;
    const color = blendColor(colors[start], colors[end], localT);

    result += chalk.rgb(255, 255, 255).bgRgb(...color)(text[i]);
  }

  return result;
}

/**
 * Logger class with gradient background labels
 */
class Logger {
  constructor() {
    this.colors = {
      INFO: [[70, 130, 180], [100, 149, 237]], // Steel Blue to Cornflower Blue
      WARN: [[255, 165, 0], [255, 140, 0]], // Orange to Dark Orange
      ERROR: [[220, 20, 60], [139, 0, 0]], // Crimson to Dark Red
      SUCCESS: [[34, 139, 34], [0, 128, 0]], // Forest Green to Green
      DEBUG: [[128, 0, 128], [75, 0, 130]] // Purple to Indigo
    };
  }

  /**
   * Create a formatted prefix with gradient background
   */
  _createPrefix(level) {
    const colors = this.colors[level] || this.colors.INFO;
    return gradientBackgroundLabel(` ${level} `, colors);
  }

  /**
   * Log info message
   */
  info(message) {
    console.log(`${this._createPrefix('INFO')} ${message}`);
  }

  /**
   * Log warning message
   */
  warn(message) {
    console.log(`${this._createPrefix('WARN')} ${message}`);
  }

  /**
   * Log error message
   */
  error(message) {
    console.log(`${this._createPrefix('ERROR')} ${message}`);
  }

  /**
   * Log success message
   */
  success(message) {
    console.log(`${this._createPrefix('SUCCESS')} ${message}`);
  }

  /**
   * Log debug message
   */
  debug(message) {
    console.log(`${this._createPrefix('DEBUG')} ${message}`);
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;