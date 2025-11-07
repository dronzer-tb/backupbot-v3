/**
 * Core backup engine orchestration
 */

const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { execSync } = require('child_process');
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

    // Detect multi-world structure
    this.worldPaths = this.detectWorldStructure();
  }

  /**
   * Detect if server uses Paper-style multi-world structure
   * @returns {Array} Array of world paths to backup
   */
  detectWorldStructure() {
    // Determine which path to use based on configuration
    const basePath = this.getSourcePath();
    const netherPath = `${basePath}_nether`;
    const endPath = `${basePath}_the_end`;

    // Check if Paper multi-world structure exists
    if (fs.existsSync(netherPath) && fs.existsSync(endPath)) {
      console.log('📁 Multi-world structure detected (Paper-based)');
      console.log(`  → Overworld: ${basePath}`);
      console.log(`  → Nether: ${netherPath}`);
      console.log(`  → End: ${endPath}`);
      return [basePath, netherPath, endPath];
    }

    // Single world structure
    console.log(`📁 Single world structure detected: ${basePath}`);
    return [basePath];
  }

  /**
   * Get the correct source path based on configuration
   * Handles Docker/Pterodactyl container path mapping
   * @returns {string} The path to use for backups
   */
  getSourcePath() {
    // If running inside container and container_path is configured, use it
    if (this.config.backup.use_container_path && this.config.backup.container_path) {
      console.log('ℹ️  Using container path for backup source');
      return this.config.backup.container_path;
    }

    // Default to host path
    return this.config.backup.source_path;
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
        source: this.worldPaths.join(', '),
        destination: backupPath,
        world_count: this.worldPaths.length
      });

      // Step 1: Check disk space (estimate all worlds)
      console.log('Checking disk space...');
      let totalEstimatedSize = 0;
      for (const worldPath of this.worldPaths) {
        const size = await this.rsync.estimateSize(worldPath);
        totalEstimatedSize += size;
      }

      const spaceCheck = await this.monitor.hasEnoughSpace(totalEstimatedSize);

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

      // Step 3.5: Fix file permissions (allows mc-backup user to read world files)
      console.log('Fixing file permissions...');
      try {
        const permResult = execSync('sudo /opt/mc-backup/scripts/fix-world-permissions.sh', { 
          timeout: 30000, // 30 second timeout
          encoding: 'utf8'
        });
        
        // Show script output
        if (permResult && permResult.trim()) {
          console.log(permResult.trim());
        }
        
        console.log('✓ Permissions fixed successfully');
      } catch (permError) {
        console.warn('⚠️  Warning: Failed to fix permissions:', permError.message);
        if (permError.stderr) {
          console.warn('   Error details:', permError.stderr.toString().trim());
        }
        console.warn('   Backup may fail if files are not readable by mc-backup user');
        // Don't throw - try to continue with backup
      }

      // Step 4: Find previous backup for --link-dest
      const previousBackup = await this.getLatestBackup();
      const linkDest = previousBackup ? path.join(this.config.backup.backup_dir, previousBackup.name) : null;

      if (linkDest) {
        console.log(`Using previous backup for hard-linking: ${previousBackup.name}`);
      }

      // Step 5: Execute rsync backup for all worlds
      console.log(`Starting rsync backup to ${backupName}...`);
      console.log(`Backing up ${this.worldPaths.length} world folder(s)...`);

      const combinedStats = {
        totalFiles: 0,
        transferredFiles: 0,
        totalSize: 0,
        transferredSize: 0,
        speedup: 0
      };

      for (const worldPath of this.worldPaths) {
        const worldName = path.basename(worldPath);
        const worldBackupPath = path.join(backupPath, worldName);
        const worldLinkDest = linkDest ? path.join(linkDest, worldName) : null;

        console.log(`  → Backing up ${worldName}...`);

        const rsyncResult = await this.rsync.backup(
          worldPath,
          worldBackupPath,
          worldLinkDest
        );

        if (!rsyncResult.success) {
          throw new Error(`rsync failed for ${worldName}: ${rsyncResult.error}`);
        }

        // Accumulate stats
        if (rsyncResult.stats) {
          combinedStats.totalFiles += rsyncResult.stats.totalFiles || 0;
          combinedStats.transferredFiles += rsyncResult.stats.transferredFiles || 0;
          combinedStats.totalSize += rsyncResult.stats.totalSize || 0;
          combinedStats.transferredSize += rsyncResult.stats.transferredSize || 0;
          combinedStats.speedup = rsyncResult.stats.speedup || 0;
        }
      }

      console.log('rsync completed successfully');

      // Step 6: Generate checksums
      console.log('Generating checksums...');
      await this.checksums.generateBackupChecksums(backupPath);

      // Step 7: Update 'latest' symlink
      await this.updateLatestSymlink(backupName);

      // Step 8: Calculate compression ratio
      const compressionRatio = this.calculateCompressionRatio(combinedStats);

      // Step 9: Run cleanup if needed
      console.log('Running retention cleanup...');
      const cleanupResult = await this.cleanup.runCleanup(triggeredBy);

      // Calculate total duration
      const duration = Date.now() - this.currentJob.startTime.getTime();

      // Log success
      logger.logBackupCompleted(triggeredBy, {
        backup_name: backupName,
        duration_ms: duration,
        world_count: this.worldPaths.length,
        worlds_backed_up: this.worldPaths.map(p => path.basename(p)),
        files_transferred: combinedStats.filesTransferred,
        bytes_transferred: combinedStats.bytesTransferred,
        total_size: combinedStats.totalSize,
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
          stats: combinedStats,
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
