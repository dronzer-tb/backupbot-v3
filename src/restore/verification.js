/**
 * Pre and post-restore verification
 */

const fs = require('fs-extra');
const ChecksumManager = require('../storage/checksums');
const StorageMonitor = require('../storage/monitoring');

class RestoreVerification {
  constructor(config) {
    this.config = config;
    this.checksums = new ChecksumManager(config.backup.backup_dir);
    this.monitor = new StorageMonitor(config);
  }

  /**
   * Verify backup integrity before restore
   * @param {string} backupPath - Path to backup directory
   */
  async verifyBackupIntegrity(backupPath) {
    try {
      console.log('Verifying backup integrity...');
      
      // Check if backup exists
      if (!await fs.pathExists(backupPath)) {
        return {
          valid: false,
          error: 'Backup directory does not exist'
        };
      }

      // Verify checksums
      const result = await this.checksums.verifyBackup(backupPath);
      
      return result;
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Check if there's enough disk space for restore
   * @param {string} backupPath - Path to backup directory
   */
  async checkDiskSpace(backupPath) {
    try {
      // Get backup size
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(`du -sb "${backupPath}" | cut -f1`);
      const backupSize = parseInt(stdout.trim());

      // Need at least 2x the backup size (original + backup during restore)
      const spaceCheck = await this.monitor.hasEnoughSpace(backupSize);

      return spaceCheck;
    } catch (error) {
      return {
        hasSpace: false,
        error: error.message
      };
    }
  }

  /**
   * Verify restore was successful
   * @param {string} restorePath - Path where backup was restored
   * @param {string} backupPath - Original backup path
   */
  async verifyRestoreSuccess(restorePath, backupPath) {
    try {
      console.log('Verifying restore success...');

      // Basic checks
      if (!await fs.pathExists(restorePath)) {
        return {
          valid: false,
          error: 'Restore path does not exist'
        };
      }

      // Compare directory sizes
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const [backupSizeOutput, restoreSizeOutput] = await Promise.all([
        execAsync(`du -sb "${backupPath}" | cut -f1`),
        execAsync(`du -sb "${restorePath}" | cut -f1`)
      ]);

      const backupSize = parseInt(backupSizeOutput.stdout.trim());
      const restoreSize = parseInt(restoreSizeOutput.stdout.trim());

      // Sizes should be approximately equal (within 1%)
      const sizeDiff = Math.abs(backupSize - restoreSize) / backupSize;

      if (sizeDiff > 0.01) {
        return {
          valid: false,
          error: `Size mismatch. Backup: ${backupSize}, Restore: ${restoreSize}`,
          backupSize,
          restoreSize
        };
      }

      return {
        valid: true,
        message: 'Restore verified successfully',
        backupSize,
        restoreSize
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Pre-restore checks
   * @param {string} backupPath - Path to backup to restore
   */
  async preRestoreChecks(backupPath) {
    const results = {
      valid: true,
      checks: {}
    };

    // Check 1: Backup exists
    results.checks.backupExists = await fs.pathExists(backupPath);
    if (!results.checks.backupExists) {
      results.valid = false;
      results.error = 'Backup does not exist';
      return results;
    }

    // Check 2: Verify integrity
    results.checks.integrity = await this.verifyBackupIntegrity(backupPath);
    if (!results.checks.integrity.valid) {
      results.valid = false;
      results.error = `Integrity check failed: ${results.checks.integrity.error}`;
      return results;
    }

    // Check 3: Check disk space
    results.checks.diskSpace = await this.checkDiskSpace(backupPath);
    if (!results.checks.diskSpace.hasSpace) {
      results.valid = false;
      results.error = `Insufficient disk space: ${results.checks.diskSpace.error || 'Not enough space'}`;
      return results;
    }

    return results;
  }

  /**
   * Post-restore checks
   * @param {string} restorePath - Path where backup was restored
   * @param {string} backupPath - Original backup path
   */
  async postRestoreChecks(restorePath, backupPath) {
    const results = {
      valid: true,
      checks: {}
    };

    // Check 1: Restore path exists
    results.checks.restoreExists = await fs.pathExists(restorePath);
    if (!results.checks.restoreExists) {
      results.valid = false;
      results.error = 'Restore path does not exist';
      return results;
    }

    // Check 2: Verify restore
    results.checks.verification = await this.verifyRestoreSuccess(restorePath, backupPath);
    if (!results.checks.verification.valid) {
      results.valid = false;
      results.error = `Restore verification failed: ${results.checks.verification.error}`;
      return results;
    }

    return results;
  }
}

module.exports = RestoreVerification;
