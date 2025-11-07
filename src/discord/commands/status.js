/**
 * !backup status command
 */

const { EmbedBuilder } = require('discord.js');

class StatusCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'status';
    this.requiredRoles = 'backup';
    this.description = 'Show current backup status';
  }

  async execute(message, args) {
    try {
      // Get backup stats
      const stats = await this.bot.backupEngine.getStats();
      
      // Get server status
      const serverStatus = await this.bot.backupEngine.serverControl.getStatus();

      // Get current job
      const currentJob = this.bot.backupEngine.getCurrentJob();

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(currentJob.running ? '#ffaa00' : '#00ff00')
        .setTitle('📊 Backup System Status')
        .setTimestamp();

      // Current job status
      if (currentJob.running) {
        const duration = Math.floor(currentJob.duration / 1000);
        embed.addFields({
          name: '🔄 Current Job',
          value: `**${currentJob.name}**\nRunning for ${duration}s\nTriggered by: ${currentJob.triggeredBy}`,
          inline: false
        });
      } else {
        embed.addFields({
          name: '✅ Current Job',
          value: 'Idle',
          inline: false
        });
      }

      // Last backup
      if (stats.latestBackup) {
        const age = this.getAge(stats.latestBackup.created);
        embed.addFields({
          name: '📁 Last Backup',
          value: `**${stats.latestBackup.name}**\n${age} • ${stats.latestBackup.size}`,
          inline: false
        });
      }

      // Storage
      embed.addFields({
        name: '💾 Storage',
        value: `**${stats.storage.disk.used}** / **${stats.storage.disk.total}** (${stats.storage.disk.percentage}%)\nAvailable: ${stats.storage.disk.available}`,
        inline: false
      });

      // Total backups
      embed.addFields({
        name: '📦 Total Backups',
        value: `${stats.totalBackups} backups\nRetention: ${stats.retention.retentionDays} days`,
        inline: false
      });

      // Server status
      const serverEmoji = serverStatus.state === 'running' ? '🟢' : '🔴';
      embed.addFields({
        name: `${serverEmoji} Minecraft Server`,
        value: `State: **${serverStatus.state}**\nUptime: ${this.formatUptime(serverStatus.uptime)}`,
        inline: false
      });

      // Next scheduled backup
      const scheduler = this.bot.backupEngine.scheduler;
      if (scheduler) {
        const schedulerStatus = scheduler.getStatus();
        if (schedulerStatus.running) {
          embed.addFields({
            name: '⏰ Scheduled Backups',
            value: `${schedulerStatus.jobCount} schedule(s) active`,
            inline: false
          });
        }
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      await message.reply(`❌ Error getting status: ${error.message}`);
    }
  }

  getAge(date) {
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  formatUptime(milliseconds) {
    if (!milliseconds) return 'N/A';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

module.exports = StatusCommand;
