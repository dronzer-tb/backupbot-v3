/**
 * Core backup engine orchestration
 */

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const RsyncWrapper = require('./rsyncWrapper');
const ChecksumManager = require('../storage/checksums');
const StorageMonitor = require('../storage/monitoring');
const CleanupManager = require('../storage/cleanup');
const logger = require('../audit/logger');

class BackupEngine {
  constructor(config, serverControl) {
    this.config = config;
    this.serverControl = serverControl;
    this.rsync = new RsyncWrapper(config);
    this.checksums = new ChecksumManager(config.backup.backup_dir);
    this.monitor = new StorageMonitor(config);
    this.cleanup = new CleanupManager(config);
    this.currentJob = null;
  }

  /**
   * Execute full backup (zero-downtime with save-all)
   * @param {string} triggeredBy - Who triggered the backup
   */
  async executeBackup(triggeredBy = 'cron') {
    const backupName = this.generateBackupName();
    const backupPath = path.join(this.config.backup.backup_dir, backupName);

    try {
      // Set current job
      this.currentJob = {
        name: backupName,
        triggeredBy,
        startTime: new Date(),
        status: 'running'
      };

      logger.logBackupStarted(triggeredBy, {
        backup_name: backupName,
        source: this.config.backup.source_path,
        destination: backupPath
      });

      // Step 1: Check disk space
      console.log('Checking disk space...');
      const estimatedSize = await this.rsync.estimateSize(this.config.backup.source_path);
      const spaceCheck = await this.monitor.hasEnoughSpace(estimatedSize);

      if (!spaceCheck.hasSpace) {
        throw new Error(`Insufficient disk space. Available: ${this.monitor.formatBytes(spaceCheck.available)}, Required: ${this.monitor.formatBytes(spaceCheck.required)}`);
      }

      // Step 2: Check if disk usage is critical
      const diskUsage = await this.monitor.getBackupDiskUsage();
      if (diskUsage.percentage >= this.monitor.criticalThreshold) {
        throw new Error(`Disk usage critical (${diskUsage.percentage}%). Backup aborted.`);
      }

      // Step 3: Send save-all command to server (zero downtime!)
      console.log('Sending save-all command to server...');
      await this.serverControl.prepareForBackup(triggeredBy);

      // Step 4: Find previous backup for --link-dest
      const previousBackup = await this.getLatestBackup();
      const linkDest = previousBackup ? path.join(this.config.backup.backup_dir, previousBackup.name) : null;

      if (linkDest) {
        console.log(`Using previous backup for hard-linking: ${previousBackup.name}`);
      }

      // Step 5: Execute rsync backup
      console.log(`Starting rsync backup to ${backupName}...`);
      const rsyncResult = await this.rsync.backup(
        this.config.backup.source_path,
        backupPath,
        linkDest
      );

      if (!rsyncResult.success) {
        throw new Error(`rsync failed: ${rsyncResult.error}`);
      }

      console.log('rsync completed successfully');

      // Step 6: Generate checksums
      console.log('Generating checksums...');
      await this.checksums.generateBackupChecksums(backupPath);

      // Step 7: Update 'latest' symlink
      await this.updateLatestSymlink(backupName);

      // Step 8: Calculate compression ratio
      const compressionRatio = this.calculateCompressionRatio(rsyncResult.stats);

      // Step 9: Run cleanup if needed
      console.log('Running retention cleanup...');
      const cleanupResult = await this.cleanup.runCleanup(triggeredBy);

      // Calculate total duration
      const duration = Date.now() - this.currentJob.startTime.getTime();

      // Log success
      logger.logBackupCompleted(triggeredBy, {
        backup_name: backupName,
        duration_ms: duration,
        total_files: rsyncResult.stats.totalFiles,
        transferred_files: rsyncResult.stats.transferredFiles,
        total_size: rsyncResult.stats.totalSize,
        transferred_size: rsyncResult.stats.transferredSize,
        compression_ratio: compressionRatio,
        cleanup_deleted: cleanupResult.deleted
      });

      // Clear current job
      this.currentJob = null;

      return {
        success: true,
        backup: {
          name: backupName,
          path: backupPath,
          duration,
          stats: rsyncResult.stats,
          compressionRatio,
          cleanupDeleted: cleanupResult.deleted
        }
      };
    } catch (error) {
      // Log failure
      logger.logBackupFailed(triggeredBy, {
        backup_name: backupName,
        error: error.message,
        duration_ms: this.currentJob ? Date.now() - this.currentJob.startTime.getTime() : 0
      });

      // Clear current job
      this.currentJob = null;

      throw error;
    }
  }

  /**
   * Generate backup directory name
   */
  generateBackupName() {
    return moment().format('YYYY-MM-DD_HHmmss');
  }

  /**
   * Get latest backup
   */
  async getLatestBackup() {
    try {
      const backups = await this.cleanup.getBackups();
      return backups.length > 0 ? backups[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update 'latest' symlink
   */
  async updateLatestSymlink(backupName) {
    try {
      const symlinkPath = path.join(this.config.backup.backup_dir, 'latest');
      const targetPath = backupName; // Relative path

      // Remove existing symlink if it exists
      if (await fs.pathExists(symlinkPath)) {
        await fs.remove(symlinkPath);
      }

      // Create new symlink
      await fs.symlink(targetPath, symlinkPath, 'dir');
    } catch (error) {
      console.error('Failed to update latest symlink:', error.message);
    }
  }

  /**
   * Calculate compression ratio from rsync stats
   */
  calculateCompressionRatio(stats) {
    if (stats.totalSize === 0) {
      return 0;
    }

    const ratio = ((1 - (stats.transferredSize / stats.totalSize)) * 100).toFixed(2);
    return parseFloat(ratio);
  }

  /**
   * Get current backup job status
   */
  getCurrentJob() {
    if (!this.currentJob) {
      return {
        running: false
      };
    }

    return {
      running: true,
      name: this.currentJob.name,
      triggeredBy: this.currentJob.triggeredBy,
      startTime: this.currentJob.startTime,
      duration: Date.now() - this.currentJob.startTime.getTime()
    };
  }

  /**
   * Cancel current backup job
   */
  async cancelBackup(triggeredBy = 'user') {
    if (!this.currentJob) {
      throw new Error('No backup job is currently running');
    }

    // TODO: Implement safe cancellation
    // For now, just log it
    logger.info('BACKUP_CANCELLED', triggeredBy, {
      backup_name: this.currentJob.name
    });

    this.currentJob = null;

    return {
      cancelled: true
    };
  }

  /**
   * Get backup statistics
   */
  async getStats() {
    try {
      const backups = await this.cleanup.getBackups();
      const latestBackup = backups.length > 0 ? backups[0] : null;
      const storageStats = await this.monitor.getStats();
      const retentionStats = await this.cleanup.getRetentionStats();

      return {
        totalBackups: backups.length,
        latestBackup: latestBackup ? {
          name: latestBackup.name,
          created: latestBackup.created,
          size: this.monitor.formatBytes(latestBackup.size)
        } : null,
        storage: storageStats,
        retention: retentionStats,
        currentJob: this.getCurrentJob()
      };
    } catch (error) {
      throw new Error(`Failed to get backup stats: ${error.message}`);
    }
  }
}

module.exports = BackupEngine;
