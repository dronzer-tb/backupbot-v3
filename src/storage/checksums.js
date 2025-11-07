/**
 * SHA-256 checksum generation and verification
 */

const fs = require('fs-extra');
const crypto = require('crypto');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ChecksumManager {
  constructor(backupDir) {
    this.backupDir = backupDir;
    this.checksumDir = path.join(backupDir, 'checksums');
  }

  /**
   * Ensure checksum directory exists
   */
  async ensureChecksumDir() {
    await fs.ensureDir(this.checksumDir);
  }

  /**
   * Generate checksum for a file
   * @param {string} filePath - Path to file
   */
  async generateFileChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Generate checksums for entire backup directory
   * @param {string} backupPath - Path to backup directory
   */
  async generateBackupChecksums(backupPath) {
    try {
      await this.ensureChecksumDir();

      const backupName = path.basename(backupPath);
      const checksumFile = path.join(this.checksumDir, `${backupName}.sha256`);

      console.log(`Generating checksums for ${backupName}...`);

      // Use find and sha256sum for better performance on large directories
      const command = `cd "${backupPath}" && find . -type f -exec sha256sum {} \\; > "${checksumFile}"`;
      
      await execAsync(command);

      console.log(`Checksums saved to ${checksumFile}`);

      return checksumFile;
    } catch (error) {
      throw new Error(`Failed to generate checksums: ${error.message}`);
    }
  }

  /**
   * Verify backup integrity using checksums
   * @param {string} backupPath - Path to backup directory
   */
  async verifyBackup(backupPath) {
    try {
      const backupName = path.basename(backupPath);
      const checksumFile = path.join(this.checksumDir, `${backupName}.sha256`);

      if (!await fs.pathExists(checksumFile)) {
        throw new Error(`Checksum file not found for backup ${backupName}`);
      }

      console.log(`Verifying backup ${backupName}...`);

      // Verify checksums
      const command = `cd "${backupPath}" && sha256sum -c "${checksumFile}" 2>&1`;
      
      try {
        const { stdout } = await execAsync(command);
        
        // Check if all files passed
        const failed = stdout.match(/FAILED/g);
        
        if (failed) {
          return {
            valid: false,
            errors: failed.length,
            message: `${failed.length} file(s) failed checksum verification`
          };
        }

        return {
          valid: true,
          message: 'All files verified successfully'
        };
      } catch (error) {
        return {
          valid: false,
          message: `Verification failed: ${error.message}`
        };
      }
    } catch (error) {
      throw new Error(`Failed to verify backup: ${error.message}`);
    }
  }

  /**
   * Get checksum file for a backup
   * @param {string} backupName - Backup directory name
   */
  getChecksumFile(backupName) {
    return path.join(this.checksumDir, `${backupName}.sha256`);
  }

  /**
   * Read checksums from file
   * @param {string} backupName - Backup directory name
   */
  async readChecksums(backupName) {
    try {
      const checksumFile = this.getChecksumFile(backupName);
      
      if (!await fs.pathExists(checksumFile)) {
        return null;
      }

      const content = await fs.readFile(checksumFile, 'utf8');
      const lines = content.trim().split('\n');

      const checksums = {};
      for (const line of lines) {
        const [hash, filePath] = line.split(/\s+/);
        if (hash && filePath) {
          checksums[filePath] = hash;
        }
      }

      return checksums;
    } catch (error) {
      throw new Error(`Failed to read checksums: ${error.message}`);
    }
  }

  /**
   * Compare two backups using checksums
   * @param {string} backup1 - First backup name
   * @param {string} backup2 - Second backup name
   */
  async compareBackups(backup1, backup2) {
    try {
      const checksums1 = await this.readChecksums(backup1);
      const checksums2 = await this.readChecksums(backup2);

      if (!checksums1 || !checksums2) {
        throw new Error('Missing checksum file(s)');
      }

      const files1 = Object.keys(checksums1);
      const files2 = Object.keys(checksums2);

      const added = files2.filter(f => !files1.includes(f));
      const removed = files1.filter(f => !files2.includes(f));
      const common = files1.filter(f => files2.includes(f));
      const modified = common.filter(f => checksums1[f] !== checksums2[f]);
      const unchanged = common.filter(f => checksums1[f] === checksums2[f]);

      return {
        added: added.length,
        removed: removed.length,
        modified: modified.length,
        unchanged: unchanged.length,
        totalFiles: files2.length
      };
    } catch (error) {
      throw new Error(`Failed to compare backups: ${error.message}`);
    }
  }
}

module.exports = ChecksumManager;
