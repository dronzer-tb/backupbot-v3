/**
 * rsync wrapper for backup operations
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs-extra');
const path = require('path');

class RsyncWrapper {
  constructor(config) {
    this.config = config;
  }

  /**
   * Execute rsync backup with --link-dest
   * @param {string} source - Source directory
   * @param {string} destination - Destination directory
   * @param {string} linkDest - Previous backup directory for hard-linking (optional)
   */
  async backup(source, destination, linkDest = null) {
    try {
      // Ensure destination parent directory exists
      await fs.ensureDir(path.dirname(destination));

      // Build rsync command
      const rsyncArgs = [
        '-aAXv',
        '--delete',
        '--stats'
      ];

      // Add link-dest if previous backup exists
      if (linkDest && await fs.pathExists(linkDest)) {
        rsyncArgs.push(`--link-dest="${linkDest}"`);
      }

      // Add source and destination
      rsyncArgs.push(`"${source}/"`); // Trailing slash is important
      rsyncArgs.push(`"${destination}/"`);

      const command = `rsync ${rsyncArgs.join(' ')}`;

      console.log(`Executing: ${command}`);

      // Execute rsync
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      const duration = Date.now() - startTime;

      // Parse rsync output for statistics
      const stats = this.parseRsyncOutput(stdout);

      return {
        success: true,
        duration,
        stats,
        stdout,
        stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }

  /**
   * Parse rsync output to extract statistics
   */
  parseRsyncOutput(output) {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      transferredFiles: 0,
      transferredSize: 0,
      speedup: 0
    };

    try {
      // Extract number of files
      const filesMatch = output.match(/Number of files: ([\d,]+)/);
      if (filesMatch) {
        stats.totalFiles = parseInt(filesMatch[1].replace(/,/g, ''));
      }

      // Extract number of created files
      const createdMatch = output.match(/Number of created files: ([\d,]+)/);
      if (createdMatch) {
        stats.transferredFiles = parseInt(createdMatch[1].replace(/,/g, ''));
      }

      // Extract total file size
      const sizeMatch = output.match(/Total file size: ([\d,]+)/);
      if (sizeMatch) {
        stats.totalSize = parseInt(sizeMatch[1].replace(/,/g, ''));
      }

      // Extract transferred size
      const transferredMatch = output.match(/Total transferred file size: ([\d,]+)/);
      if (transferredMatch) {
        stats.transferredSize = parseInt(transferredMatch[1].replace(/,/g, ''));
      }

      // Extract speedup
      const speedupMatch = output.match(/speedup is ([\d.]+)/);
      if (speedupMatch) {
        stats.speedup = parseFloat(speedupMatch[1]);
      }
    } catch (error) {
      console.error('Failed to parse rsync output:', error.message);
    }

    return stats;
  }

  /**
   * Restore backup using rsync
   * @param {string} source - Backup directory
   * @param {string} destination - Restore destination
   */
  async restore(source, destination) {
    try {
      // Ensure destination parent directory exists
      await fs.ensureDir(path.dirname(destination));

      // Build rsync command
      const command = `rsync -aAXv --delete --stats "${source}/" "${destination}/"`;

      console.log(`Executing: ${command}`);

      // Execute rsync
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      const duration = Date.now() - startTime;

      // Parse rsync output for statistics
      const stats = this.parseRsyncOutput(stdout);

      return {
        success: true,
        duration,
        stats,
        stdout,
        stderr
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }

  /**
   * Estimate backup size (dry-run)
   * @param {string} source - Source directory
   */
  async estimateSize(source) {
    try {
      // Check if source exists
      if (!await fs.pathExists(source)) {
        console.warn(`⚠️  Path does not exist: ${source}`);
        return 0;
      }

      const command = `du -sb "${source}" | cut -f1`;
      const { stdout } = await execAsync(command);
      const size = parseInt(stdout.trim()) || 0;

      if (isNaN(size)) {
        console.warn(`⚠️  Could not determine size for: ${source}`);
        return 0;
      }

      return size;
    } catch (error) {
      console.warn(`⚠️  Failed to estimate size for ${source}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Test rsync availability
   */
  async testRsync() {
    try {
      const { stdout } = await execAsync('rsync --version');
      const versionMatch = stdout.match(/rsync\s+version\s+([\d.]+)/);

      return {
        available: true,
        version: versionMatch ? versionMatch[1] : 'unknown'
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

module.exports = RsyncWrapper;
