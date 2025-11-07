/**
 * !backup help command
 */

const { EmbedBuilder } = require('discord.js');

class HelpCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'help';
    this.requiredRoles = 'backup';
    this.description = 'Show available commands';
  }

  async execute(message, args) {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📚 Minecraft Backup System - Commands')
      .setDescription('Available backup commands:')
      .addFields(
        { name: '!backup now', value: 'Trigger immediate backup (zero downtime)', inline: false },
        { name: '!backup list [local|offsite|all]', value: 'List available backups', inline: false },
        { name: '!backup restore <backup_id>', value: 'Restore a specific backup (Admin only)', inline: false },
        { name: '!backup status', value: 'Show current backup status', inline: false },
        { name: '!backup logs [count]', value: 'Display recent audit logs', inline: false },
        { name: '!backup info <backup_id>', value: 'Show detailed backup information', inline: false },
        { name: '!backup cancel', value: 'Cancel ongoing backup (Admin only)', inline: false },
        { name: '!backup config', value: 'Display current configuration', inline: false },
        { name: '!backup help', value: 'Show this help message', inline: false }
      )
      .setFooter({ text: 'Minecraft Backup System v1.0' })
      .setTimestamp();

    // Add offsite command if enabled
    if (this.bot.config.rclone?.enabled) {
      embed.addFields(
        { name: '!backup offsite', value: 'Show offsite sync status and force sync', inline: false }
      );
    }

    await message.reply({ embeds: [embed] });
  }
}

module.exports = HelpCommand;
