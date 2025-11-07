/**
 * Configuration manager
 */

const fs = require('fs-extra');
const path = require('path');
const validator = require('./validator');

class ConfigManager {
  constructor(configPath = '/etc/mc-backup/config.json') {
    this.configPath = configPath;
    this.config = null;
  }

  /**
   * Load configuration from file
   */
  async load() {
    try {
      // Check if config file exists
      if (!await fs.pathExists(this.configPath)) {
        // Try alternative paths
        const altPaths = [
          './config/config.json',
          path.join(__dirname, '../../config/config.json'),
          '/opt/mc-backup/config/config.json'
        ];

        for (const altPath of altPaths) {
          if (await fs.pathExists(altPath)) {
            this.configPath = altPath;
            break;
          }
        }

        if (!await fs.pathExists(this.configPath)) {
          throw new Error(`Configuration file not found at ${this.configPath}`);
        }
      }

      // Read and parse config
      const configData = await fs.readJSON(this.configPath);
      
      // Validate configuration
      const validation = validator.validate(configData);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      this.config = configData;
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Save configuration to file
   */
  async save(config = this.config) {
    try {
      // Validate before saving
      const validation = validator.validate(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(this.configPath));

      // Write config with proper formatting
      await fs.writeJSON(this.configPath, config, { spaces: 2 });

      this.config = config;
      return true;
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration value
   */
  get(key) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const keys = key.split('.');
    let obj = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k];
    }

    obj[keys[keys.length - 1]] = value;
  }

  /**
   * Get masked configuration (hide sensitive data)
   */
  getMasked() {
    if (!this.config) {
      return null;
    }

    const masked = JSON.parse(JSON.stringify(this.config));

    // Mask sensitive fields
    if (masked.pterodactyl?.api_key) {
      masked.pterodactyl.api_key = this.maskString(masked.pterodactyl.api_key);
    }
    if (masked.discord?.bot_token) {
      masked.discord.bot_token = this.maskString(masked.discord.bot_token);
    }

    return masked;
  }

  /**
   * Mask a string (show first and last 4 characters)
   */
  maskString(str) {
    if (!str || str.length <= 8) {
      return '***';
    }
    return str.slice(0, 4) + '***' + str.slice(-4);
  }

  /**
   * Reload configuration from file
   */
  async reload() {
    return this.load();
  }

  /**
   * Get all configuration
   */
  getAll() {
    return this.config;
  }

  /**
   * Validate current configuration
   */
  validate() {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return validator.validate(this.config);
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: (configPath) => {
    if (!instance) {
      instance = new ConfigManager(configPath);
    }
    return instance;
  },
  ConfigManager
};
