/**
 * !backup logs command
 */

const { EmbedBuilder } = require('discord.js');
const AuditReader = require('../../audit/reader');

class LogsCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'logs';
    this.requiredRoles = 'backup';
    this.description = 'Display recent audit logs';
  }

  async execute(message, args) {
    try {
      const count = parseInt(args[0]) || 10;
      
      if (count < 1 || count > 50) {
        await message.reply('❌ Count must be between 1 and 50');
        return;
      }

      // Get audit reader
      const reader = new AuditReader(this.bot.config.audit.log_path);
      
      // Get recent entries
      const entries = await reader.getRecent(count);

      if (entries.length === 0) {
        await message.reply('📝 No log entries found.');
        return;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📝 Recent Audit Logs (${entries.length})`)
        .setDescription('Latest system events');

      for (const entry of entries) {
        const emoji = this.getEmoji(entry.result);
        const timestamp = new Date(entry.timestamp).toLocaleString();
        const value = `${timestamp}\nBy: ${entry.triggered_by}`;
        
        embed.addFields({
          name: `${emoji} ${entry.action}`,
          value,
          inline: false
        });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      await message.reply(`❌ Error reading logs: ${error.message}`);
    }
  }

  getEmoji(result) {
    switch (result) {
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    case 'warning':
      return '⚠️';
    default:
      return 'ℹ️';
    }
  }
}

module.exports = LogsCommand;
