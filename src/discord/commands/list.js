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

  async executeSlash(interaction) {
    await interaction.deferReply();
    
    try {
      const count = interaction.options.getInteger('count') || 10;
      const embed = await this.buildListEmbed(count);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`❌ Error listing backups: ${error.message}`);
    }
  }

  async execute(message, args) {
    try {
      const count = parseInt(args[0]) || 10;
      const embed = await this.buildListEmbed(count);
      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ Error listing backups: ${error.message}`);
    }
  }

  async buildListEmbed(count = 10) {
    // Get local backups
    const backups = await this.bot.backupEngine.cleanup.getBackups();

    if (backups.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📁 No Backups Found')
        .setDescription('No backups available yet.');
      return embed;
    }

    // Limit to requested count
    const displayBackups = backups.slice(0, Math.min(count, 50));

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📁 Available Backups (${backups.length} total)`)
      .setDescription(`Showing ${displayBackups.length} most recent backups`);

    for (const backup of displayBackups) {
      const age = this.getAge(backup.created);
      const size = this.formatBytes(backup.size);
      
      embed.addFields({
        name: `${this.getIcon(backup)} ${backup.name}`,
        value: `📅 ${age} • 💾 ${size}`,
        inline: false
      });
    }

    if (backups.length > displayBackups.length) {
      embed.setFooter({ text: `Showing ${displayBackups.length} of ${backups.length} backups` });
    }

    return embed;
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
