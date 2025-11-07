/**
 * Disk usage monitoring and alerts
 */

const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../audit/logger');

class StorageMonitor {
  constructor(config) {
    this.config = config;
    this.backupDir = config.backup.backup_dir;
    this.warningThreshold = config.alerts?.disk_usage_warning || 80;
    this.criticalThreshold = config.alerts?.disk_usage_critical || 95;
    this.lastAlertLevel = null;
  }

  /**
   * Get disk usage for a path
   * @param {string} path - Path to check
   */
  async getDiskUsage(path) {
    try {
      // Ensure the directory exists
      await fs.ensureDir(path);

      const { stdout } = await execAsync(`df -k "${path}" | tail -n 1`);
      const parts = stdout.trim().split(/\s+/);

      // Parse values, handling potential errors
      const total = parseInt(parts[1]) || 0;
      const used = parseInt(parts[2]) || 0;
      const available = parseInt(parts[3]) || 0;
      const percentage = parseInt(parts[4]) || 0;

      return {
        filesystem: parts[0],
        total: total * 1024, // Convert to bytes
        used: used * 1024,
        available: available * 1024,
        percentage: percentage,
        mountpoint: parts[5]
      };
    } catch (error) {
      throw new Error(`Failed to get disk usage: ${error.message}`);
    }
  }

  /**
   * Get disk usage for backup directory
   */
  async getBackupDiskUsage() {
    return this.getDiskUsage(this.backupDir);
  }

  /**
   * Get size of a directory
   * @param {string} dirPath - Directory path
   */
  async getDirectorySize(dirPath) {
    try {
      const { stdout } = await execAsync(`du -sb "${dirPath}" | cut -f1`);
      return parseInt(stdout.trim());
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get backup directory total size
   */
  async getBackupDirectorySize() {
    return this.getDirectorySize(this.backupDir);
  }

  /**
   * Check disk usage and send alerts if needed
   */
  async checkDiskUsage(triggeredBy = 'system') {
    try {
      const usage = await this.getBackupDiskUsage();
      const percentage = usage.percentage;

      // Determine alert level
      let alertLevel = null;
      if (percentage >= this.criticalThreshold) {
        alertLevel = 'critical';
      } else if (percentage >= this.warningThreshold) {
        alertLevel = 'warning';
      }

      // Send alert if level changed or is critical
      if (alertLevel && (alertLevel !== this.lastAlertLevel || alertLevel === 'critical')) {
        await this.sendAlert(alertLevel, usage, triggeredBy);
        this.lastAlertLevel = alertLevel;
      } else if (!alertLevel && this.lastAlertLevel) {
        // Clear alert if usage is back to normal
        this.lastAlertLevel = null;
      }

      return {
        percentage,
        alertLevel,
        usage
      };
    } catch (error) {
      throw new Error(`Failed to check disk usage: ${error.message}`);
    }
  }

  /**
   * Send storage alert
   */
  async sendAlert(level, usage, triggeredBy) {
    const details = {
      percentage: usage.percentage,
      total: this.formatBytes(usage.total),
      used: this.formatBytes(usage.used),
      available: this.formatBytes(usage.available),
      mountpoint: usage.mountpoint,
      threshold: level === 'critical' ? this.criticalThreshold : this.warningThreshold
    };

    if (level === 'critical') {
      logger.logStorageAlert('error', triggeredBy, details);
    } else {
      logger.logStorageAlert('warn', triggeredBy, details);
    }

    return details;
  }

  /**
   * Check if there's enough space for a backup
   * @param {number} estimatedSize - Estimated backup size in bytes
   */
  async hasEnoughSpace(estimatedSize) {
    try {
      const usage = await this.getBackupDiskUsage();

      // Need at least 2x the estimated size for safety
      const requiredSpace = estimatedSize * 2;

      return {
        hasSpace: usage.available >= requiredSpace,
        available: usage.available,
        required: requiredSpace,
        percentage: usage.percentage
      };
    } catch (error) {
      return {
        hasSpace: false,
        error: error.message
      };
    }
  }

  /**
   * Get space statistics
   */
  async getStats() {
    try {
      const diskUsage = await this.getBackupDiskUsage();
      const backupSize = await this.getBackupDirectorySize();

      return {
        disk: {
          total: this.formatBytes(diskUsage.total),
          used: this.formatBytes(diskUsage.used),
          available: this.formatBytes(diskUsage.available),
          percentage: diskUsage.percentage
        },
        backups: {
          totalSize: this.formatBytes(backupSize)
        },
        thresholds: {
          warning: this.warningThreshold,
          critical: this.criticalThreshold
        }
      };
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Check if disk usage is critical
   */
  async isCritical() {
    const usage = await this.getBackupDiskUsage();
    return usage.percentage >= this.criticalThreshold;
  }

  /**
   * Check if disk usage is at warning level
   */
  async isWarning() {
    const usage = await this.getBackupDiskUsage();
    return usage.percentage >= this.warningThreshold;
  }
}

module.exports = StorageMonitor;
