/**
 * !backup list command
 */

const { EmbedBuilder } = require('discord.js');

class ListCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'list';
    this.requiredRoles = 'backup';
    this.description = 'List available backups';
  }

  async execute(message, args) {
    try {
      const location = args[0]?.toLowerCase() || 'all';

      if (!['local', 'offsite', 'all'].includes(location)) {
        await message.reply('❌ Invalid location. Use: local, offsite, or all');
        return;
      }

      // Get local backups
      const backups = await this.bot.backupEngine.cleanup.getBackups();

      if (backups.length === 0) {
        await message.reply('📁 No backups found.');
        return;
      }

      // Limit to 10 most recent backups
      const displayBackups = backups.slice(0, 10);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📁 Available Backups (${backups.length} total)`)
        .setDescription('Showing 10 most recent backups');

      for (const backup of displayBackups) {
        const age = this.getAge(backup.created);
        const size = this.formatBytes(backup.size);
        
        embed.addFields({
          name: `${this.getIcon(backup)} ${backup.name}`,
          value: `📅 ${age} • 💾 ${size}`,
          inline: false
        });
      }

      if (backups.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${backups.length} backups` });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      await message.reply(`❌ Error listing backups: ${error.message}`);
    }
  }

  getIcon(backup) {
    if (backup.name.startsWith('pre-restore_')) {
      return '📸'; // Snapshot
    }
    return '💾'; // Regular backup
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

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

module.exports = ListCommand;
