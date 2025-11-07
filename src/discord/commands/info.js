/**
 * !backup info command
 */

const { EmbedBuilder } = require('discord.js');
const path = require('path');

class InfoCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'info';
    this.requiredRoles = 'backup';
    this.description = 'Show detailed backup information';
  }

  async executeSlash(interaction) {
    const backupName = interaction.options.getString('backup');
    await this.execute({ reply: interaction.reply.bind(interaction) }, [backupName]);
  }

  async execute(message, args) {
    try {
      if (args.length === 0) {
        await message.reply('❌ Please specify a backup name. Use `!backup list` to see available backups.');
        return;
      }

      const backupName = args[0];

      // Find backup
      const backups = await this.bot.backupEngine.cleanup.getBackups();
      const backup = backups.find(b => b.name === backupName);

      if (!backup) {
        await message.reply(`❌ Backup not found: ${backupName}`);
        return;
      }

      // Get checksum info
      const checksums = await this.bot.backupEngine.checksums.readChecksums(backupName);
      const fileCount = checksums ? Object.keys(checksums).length : 0;

      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📦 Backup Information: ${backupName}`)
        .addFields(
          { name: '📅 Created', value: backup.created.toLocaleString(), inline: true },
          { name: '💾 Size', value: this.formatBytes(backup.size), inline: true },
          { name: '📄 Files', value: fileCount.toString(), inline: true },
          { name: '📍 Location', value: backup.path, inline: false },
          { name: '🔒 Checksums', value: checksums ? '✅ Available' : '❌ Not found', inline: true },
          { name: '📦 Type', value: backup.name.startsWith('pre-restore_') ? '📸 Snapshot' : '💾 Regular Backup', inline: true }
        )
        .setTimestamp();

      // Add age
      const age = this.getAge(backup.created);
      embed.setFooter({ text: `Age: ${age}` });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      await message.reply(`❌ Error getting backup info: ${error.message}`);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  getAge(date) {
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'Just now';
  }
}

module.exports = InfoCommand;
