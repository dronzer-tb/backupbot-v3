/**
 * File permissions handler
 */

const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class PermissionManager {
  /**
   * Set file permissions
   * @param {string} path - Path to file or directory
   * @param {string} mode - Permission mode (e.g., '755', '644')
   */
  static async setPermissions(path, mode) {
    try {
      await fs.chmod(path, parseInt(mode, 8));
      return true;
    } catch (error) {
      console.error(`Failed to set permissions on ${path}:`, error.message);
      return false;
    }
  }

  /**
   * Set file owner
   * @param {string} path - Path to file or directory
   * @param {string} owner - Owner (e.g., 'mc-backup:mc-backup')
   */
  static async setOwner(path, owner) {
    try {
      await execAsync(`chown -R ${owner} ${path}`);
      return true;
    } catch (error) {
      console.error(`Failed to set owner on ${path}:`, error.message);
      return false;
    }
  }

  /**
   * Check if path is readable
   * @param {string} path - Path to check
   */
  static async isReadable(path) {
    try {
      await fs.access(path, fs.constants.R_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if path is writable
   * @param {string} path - Path to check
   */
  static async isWritable(path) {
    try {
      await fs.access(path, fs.constants.W_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure directory exists with proper permissions
   * @param {string} path - Directory path
   * @param {string} mode - Permission mode
   */
  static async ensureDirectory(path, mode = '755') {
    try {
      await fs.ensureDir(path);
      await this.setPermissions(path, mode);
      return true;
    } catch (error) {
      console.error(`Failed to ensure directory ${path}:`, error.message);
      return false;
    }
  }
}

module.exports = PermissionManager;
