/**
 * Audit log reader and query interface
 */

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class AuditReader {
  constructor(logPath) {
    this.logPath = logPath || '/var/log/mc-backup';
  }

  /**
   * Get all log files sorted by date
   */
  async getLogFiles() {
    try {
      const files = await fs.readdir(this.logPath);
      const logFiles = files
        .filter(f => f.startsWith('audit-') && f.endsWith('.log'))
        .sort()
        .reverse();
      
      return logFiles.map(f => path.join(this.logPath, f));
    } catch (error) {
      console.error('Failed to read log directory:', error.message);
      return [];
    }
  }

  /**
   * Read and parse log entries
   * @param {object} filters - Filter criteria
   * @param {number} limit - Maximum number of entries to return
   */
  async query(filters = {}, limit = 10) {
    const logFiles = await this.getLogFiles();
    const entries = [];
    
    for (const logFile of logFiles) {
      if (entries.length >= limit) break;
      
      try {
        const fileEntries = await this.readLogFile(logFile, filters, limit - entries.length);
        entries.push(...fileEntries);
      } catch (error) {
        console.error(`Failed to read log file ${logFile}:`, error.message);
      }
    }
    
    return entries.slice(0, limit);
  }

  /**
   * Read entries from a single log file
   */
  async readLogFile(filePath, filters, limit) {
    return new Promise((resolve, reject) => {
      const entries = [];
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (entries.length >= limit) {
          rl.close();
          return;
        }

        try {
          const entry = JSON.parse(line);
          
          if (this.matchesFilters(entry, filters)) {
            entries.push(entry);
          }
        } catch (error) {
          // Skip invalid JSON lines
        }
      });

      rl.on('close', () => resolve(entries));
      rl.on('error', reject);
    });
  }

  /**
   * Check if entry matches filters
   */
  matchesFilters(entry, filters) {
    if (filters.action && entry.action !== filters.action) {
      return false;
    }
    
    if (filters.level && entry.level !== filters.level) {
      return false;
    }
    
    if (filters.result && entry.result !== filters.result) {
      return false;
    }
    
    if (filters.triggered_by && !entry.triggered_by?.includes(filters.triggered_by)) {
      return false;
    }
    
    if (filters.startDate) {
      const entryDate = new Date(entry.timestamp);
      const startDate = new Date(filters.startDate);
      if (entryDate < startDate) {
        return false;
      }
    }
    
    if (filters.endDate) {
      const entryDate = new Date(entry.timestamp);
      const endDate = new Date(filters.endDate);
      if (entryDate > endDate) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get recent entries
   */
  async getRecent(count = 10) {
    return this.query({}, count);
  }

  /**
   * Get entries by action type
   */
  async getByAction(action, count = 10) {
    return this.query({ action }, count);
  }

  /**
   * Get entries by result
   */
  async getByResult(result, count = 10) {
    return this.query({ result }, count);
  }

  /**
   * Get failed operations
   */
  async getFailures(count = 10) {
    return this.query({ result: 'failure' }, count);
  }

  /**
   * Format entries for display
   */
  formatEntries(entries) {
    return entries.map(entry => {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      const symbol = entry.result === 'success' ? '✅' : entry.result === 'failure' ? '❌' : '⚠️';
      
      return `${symbol} [${timestamp}] ${entry.action} (by ${entry.triggered_by})`;
    });
  }
}

module.exports = AuditReader;
