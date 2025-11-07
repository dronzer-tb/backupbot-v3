/**
 * Restore engine with safety features
 */

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const RsyncWrapper = require('../backup/rsyncWrapper');
const RestoreVerification = require('./verification');
const logger = require('../audit/logger');

class RestoreEngine {
  constructor(config, serverControl) {
    this.config = config;
    this.serverControl = serverControl;
    this.rsync = new RsyncWrapper(config);
    this.verification = new RestoreVerification(config);
    this.currentRestore = null;
  }

  /**
   * Restore a backup
   * @param {string} backupName - Name of backup to restore
   * @param {string} triggeredBy - Who triggered the restore
   * @param {object} options - Restore options
   */
  async restoreBackup(backupName, triggeredBy = 'user', options = {}) {
    const backupPath = path.join(this.config.backup.backup_dir, backupName);
    const restorePath = this.config.backup.source_path;

    try {
      // Set current restore job
      this.currentRestore = {
        backupName,
        triggeredBy,
        startTime: new Date(),
        status: 'running'
      };

      logger.logRestoreInitiated(triggeredBy, {
        backup_name: backupName,
        backup_path: backupPath,
        restore_path: restorePath
      });

      // Step 1: Pre-restore validation
      console.log('Running pre-restore checks...');
      const preChecks = await this.verification.preRestoreChecks(backupPath);

      if (!preChecks.valid) {
        throw new Error(`Pre-restore checks failed: ${preChecks.error}`);
      }

      console.log('Pre-restore checks passed');

      // Step 2: Create pre-restore snapshot
      console.log('Creating pre-restore snapshot...');
      const snapshotName = await this.createPreRestoreSnapshot(restorePath);
      console.log(`Pre-restore snapshot created: ${snapshotName}`);

      // Step 3: Stop server
      console.log('Stopping server...');
      await this.serverControl.stopServer(triggeredBy);
      console.log('Server stopped');

      // Step 4: Execute restore
      console.log(`Restoring backup ${backupName}...`);
      const rsyncResult = await this.rsync.restore(backupPath, restorePath);

      if (!rsyncResult.success) {
        throw new Error(`Restore failed: ${rsyncResult.error}`);
      }

      console.log('Restore completed');

      // Step 5: Verify restore
      console.log('Verifying restored files...');
      const postChecks = await this.verification.postRestoreChecks(restorePath, backupPath);

      if (!postChecks.valid) {
        throw new Error(`Post-restore verification failed: ${postChecks.error}`);
      }

      console.log('Verification passed');

      // Step 6: Start server
      console.log('Starting server...');
      await this.serverControl.startServer(triggeredBy);
      console.log('Server started');

      // Step 7: Monitor server startup (60s)
      console.log('Monitoring server startup...');
      await this.monitorServerStartup(60);

      // Calculate total duration
      const duration = Date.now() - this.currentRestore.startTime.getTime();

      // Log success
      logger.logRestoreCompleted(triggeredBy, {
        backup_name: backupName,
        snapshot_name: snapshotName,
        duration_ms: duration,
        total_files: rsyncResult.stats.totalFiles,
        transferred_size: rsyncResult.stats.transferredSize
      });

      // Clear current restore
      this.currentRestore = null;

      return {
        success: true,
        backupName,
        snapshotName,
        duration,
        stats: rsyncResult.stats
      };
    } catch (error) {
      // Log failure
      logger.logRestoreFailed(triggeredBy, {
        backup_name: backupName,
        error: error.message,
        duration_ms: this.currentRestore ? Date.now() - this.currentRestore.startTime.getTime() : 0
      });

      // Try to start server anyway
      try {
        console.log('Attempting to start server after restore failure...');
        await this.serverControl.startServer(triggeredBy);
      } catch (startError) {
        console.error('Failed to start server:', startError.message);
      }

      // Clear current restore
      this.currentRestore = null;

      throw error;
    }
  }

  /**
   * Create pre-restore snapshot of current world
   * @param {string} sourcePath - Path to current world
   */
  async createPreRestoreSnapshot(sourcePath) {
    try {
      const snapshotName = `pre-restore_${moment().format('YYYY-MM-DD_HHmmss')}`;
      const snapshotPath = path.join(this.config.backup.backup_dir, snapshotName);

      // Use rsync to create snapshot
      const rsyncResult = await this.rsync.backup(sourcePath, snapshotPath);

      if (!rsyncResult.success) {
        throw new Error(`Failed to create pre-restore snapshot: ${rsyncResult.error}`);
      }

      return snapshotName;
    } catch (error) {
      throw new Error(`Failed to create pre-restore snapshot: ${error.message}`);
    }
  }

  /**
   * Monitor server startup for crashes
   * @param {number} timeout - Timeout in seconds
   */
  async monitorServerStartup(timeout = 60) {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.serverControl.getStatus();

        if (status.state === 'running') {
          console.log('Server is running normally');
          return true;
        }

        if (status.state === 'offline') {
          throw new Error('Server crashed during startup');
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error monitoring server:', error.message);
      }
    }

    throw new Error('Server startup monitoring timed out');
  }

  /**
   * Rollback to pre-restore snapshot
   * @param {string} snapshotName - Name of pre-restore snapshot
   * @param {string} triggeredBy - Who triggered the rollback
   */
  async rollbackToSnapshot(snapshotName, triggeredBy = 'user') {
    try {
      console.log(`Rolling back to snapshot: ${snapshotName}`);

      return await this.restoreBackup(snapshotName, triggeredBy);
    } catch (error) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Get list of pre-restore snapshots
   */
  async getPreRestoreSnapshots() {
    try {
      const items = await fs.readdir(this.config.backup.backup_dir);
      const snapshots = [];

      for (const item of items) {
        if (item.startsWith('pre-restore_')) {
          const itemPath = path.join(this.config.backup.backup_dir, item);
          const stats = await fs.stat(itemPath);

          snapshots.push({
            name: item,
            path: itemPath,
            created: stats.birthtime,
            size: await this.getDirectorySize(itemPath)
          });
        }
      }

      // Sort by creation date (newest first)
      snapshots.sort((a, b) => b.created - a.created);

      return snapshots;
    } catch (error) {
      throw new Error(`Failed to get pre-restore snapshots: ${error.message}`);
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
   * Get current restore job status
   */
  getCurrentRestore() {
    if (!this.currentRestore) {
      return {
        running: false
      };
    }

    return {
      running: true,
      backupName: this.currentRestore.backupName,
      triggeredBy: this.currentRestore.triggeredBy,
      startTime: this.currentRestore.startTime,
      duration: Date.now() - this.currentRestore.startTime.getTime()
    };
  }
}

module.exports = RestoreEngine;
