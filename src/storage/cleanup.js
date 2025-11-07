/**
 * Backup retention and cleanup
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../audit/logger');

class CleanupManager {
  constructor(config) {
    this.config = config;
    this.backupDir = config.backup.backup_dir;
    this.retentionDays = config.backup.retention_local_days;
  }

  /**
   * Get all backup directories
   */
  async getBackups() {
    try {
      const items = await fs.readdir(this.backupDir);
      const backups = [];

      for (const item of items) {
        const itemPath = path.join(this.backupDir, item);
        const stats = await fs.stat(itemPath);

        // Skip if not a directory
        if (!stats.isDirectory()) {
          continue;
        }

        // Skip special directories
        if (item === 'checksums' || item.startsWith('pre-restore_')) {
          continue;
        }

        // Skip symlinks (like 'latest')
        const lstat = await fs.lstat(itemPath);
        if (lstat.isSymbolicLink()) {
          continue;
        }

        backups.push({
          name: item,
          path: itemPath,
          created: stats.birthtime,
          modified: stats.mtime,
          size: await this.getDirectorySize(itemPath)
        });
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      throw new Error(`Failed to get backups: ${error.message}`);
    }
  }

  /**
   * Get directory size
   */
  async getDirectorySize(dirPath) {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(`du -sb "${dirPath}" | cut -f1`);
      return parseInt(stdout.trim());
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get backups to delete based on retention policy
   */
  async getBackupsToDelete() {
    try {
      const backups = await this.getBackups();
      const now = new Date();
      const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;

      const toDelete = backups.filter(backup => {
        const age = now - backup.created;
        return age > retentionMs;
      });

      return toDelete;
    } catch (error) {
      throw new Error(`Failed to get backups to delete: ${error.message}`);
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupPath, backupName) {
    try {
      // Delete backup directory
      await fs.remove(backupPath);

      // Delete associated checksum file
      const checksumFile = path.join(this.backupDir, 'checksums', `${backupName}.sha256`);
      if (await fs.pathExists(checksumFile)) {
        await fs.remove(checksumFile);
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to delete backup: ${error.message}`);
    }
  }

  /**
   * Run cleanup based on retention policy
   */
  async runCleanup(triggeredBy = 'system') {
    try {
      const toDelete = await this.getBackupsToDelete();

      if (toDelete.length === 0) {
        logger.logCleanup(triggeredBy, {
          deleted: 0,
          message: 'No backups to delete'
        });
        return {
          deleted: 0,
          backups: []
        };
      }

      const deletedBackups = [];
      let totalSizeFreed = 0;

      for (const backup of toDelete) {
        try {
          await this.deleteBackup(backup.path, backup.name);
          deletedBackups.push(backup.name);
          totalSizeFreed += backup.size;
          
          console.log(`Deleted old backup: ${backup.name}`);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.name}:`, error.message);
        }
      }

      logger.logCleanup(triggeredBy, {
        deleted: deletedBackups.length,
        backups: deletedBackups,
        sizeFreed: this.formatBytes(totalSizeFreed),
        retentionDays: this.retentionDays
      });

      return {
        deleted: deletedBackups.length,
        backups: deletedBackups,
        sizeFreed: totalSizeFreed
      };
    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get retention statistics
   */
  async getRetentionStats() {
    try {
      const backups = await this.getBackups();
      const toDelete = await this.getBackupsToDelete();

      const now = new Date();
      const oldestBackup = backups.length > 0 ? backups[backups.length - 1] : null;
      const newestBackup = backups.length > 0 ? backups[0] : null;

      return {
        total: backups.length,
        toDelete: toDelete.length,
        toKeep: backups.length - toDelete.length,
        retentionDays: this.retentionDays,
        oldest: oldestBackup ? {
          name: oldestBackup.name,
          age: Math.floor((now - oldestBackup.created) / (1000 * 60 * 60 * 24))
        } : null,
        newest: newestBackup ? {
          name: newestBackup.name,
          age: Math.floor((now - newestBackup.created) / (1000 * 60 * 60 * 24))
        } : null
      };
    } catch (error) {
      throw new Error(`Failed to get retention stats: ${error.message}`);
    }
  }

  /**
   * Delete specific backup by name
   */
  async deleteBackupByName(backupName, triggeredBy = 'system') {
    try {
      const backupPath = path.join(this.backupDir, backupName);

      // Check if backup exists
      if (!await fs.pathExists(backupPath)) {
        throw new Error(`Backup ${backupName} not found`);
      }

      // Don't delete pre-restore snapshots
      if (backupName.startsWith('pre-restore_')) {
        throw new Error('Cannot delete pre-restore snapshots');
      }

      const size = await this.getDirectorySize(backupPath);
      await this.deleteBackup(backupPath, backupName);

      logger.logCleanup(triggeredBy, {
        deleted: 1,
        backups: [backupName],
        sizeFreed: this.formatBytes(size),
        manual: true
      });

      return {
        deleted: true,
        backup: backupName,
        sizeFreed: size
      };
    } catch (error) {
      throw new Error(`Failed to delete backup ${backupName}: ${error.message}`);
    }
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

module.exports = CleanupManager;
