/**
 * Cron-based backup scheduler
 */

const cron = require('node-cron');
const logger = require('../audit/logger');

class BackupScheduler {
  constructor(config, backupEngine) {
    this.config = config;
    this.backupEngine = backupEngine;
    this.scheduledJobs = [];
  }

  /**
   * Start all scheduled backups
   */
  start() {
    const schedules = this.config.backup.cron_schedules || [];

    if (schedules.length === 0) {
      console.log('No backup schedules configured');
      return;
    }

    for (const schedule of schedules) {
      this.scheduleBackup(schedule);
    }

    console.log(`Started ${this.scheduledJobs.length} backup schedule(s)`);
  }

  /**
   * Schedule a single backup job
   * @param {string} cronExpression - Cron expression
   */
  scheduleBackup(cronExpression) {
    try {
      const job = cron.schedule(cronExpression, async () => {
        console.log(`Scheduled backup triggered by cron: ${cronExpression}`);
        
        try {
          await this.backupEngine.executeBackup('cron');
        } catch (error) {
          console.error('Scheduled backup failed:', error.message);
        }
      });

      this.scheduledJobs.push({
        cron: cronExpression,
        job
      });

      console.log(`Scheduled backup: ${cronExpression}`);
    } catch (error) {
      console.error(`Failed to schedule backup ${cronExpression}:`, error.message);
    }
  }

  /**
   * Stop all scheduled backups
   */
  stop() {
    for (const scheduledJob of this.scheduledJobs) {
      scheduledJob.job.stop();
    }

    console.log(`Stopped ${this.scheduledJobs.length} backup schedule(s)`);
    this.scheduledJobs = [];
  }

  /**
   * Get next scheduled backup time
   */
  getNextScheduledBackup() {
    // This is a simplified version - cron doesn't provide next run time easily
    // In production, you might want to use a library like cron-parser
    const schedules = this.config.backup.cron_schedules || [];
    
    if (schedules.length === 0) {
      return null;
    }

    // Return the cron expressions
    return {
      schedules,
      count: schedules.length
    };
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.scheduledJobs.length > 0,
      jobCount: this.scheduledJobs.length,
      schedules: this.scheduledJobs.map(j => j.cron)
    };
  }

  /**
   * Restart scheduler
   */
  restart() {
    this.stop();
    this.start();
  }
}

module.exports = BackupScheduler;
