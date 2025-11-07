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

  async executeSlash(interaction) {
    await interaction.deferReply();
    const count = interaction.options.getInteger('count') || 20;
    
    try {
      const embed = await this.buildLogsEmbed(count);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`❌ Error retrieving logs: ${error.message}`);
    }
  }

  async execute(message, args) {
    try {
      const count = parseInt(args[0]) || 10;
      const embed = await this.buildLogsEmbed(count);
      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply(`❌ Error reading logs: ${error.message}`);
    }
  }

  async buildLogsEmbed(count = 10) {
    if (count < 1 || count > 100) {
      throw new Error('Count must be between 1 and 100');
    }

    // Get audit reader
    const reader = new AuditReader(this.bot.config.audit.log_path);
    
    // Get recent entries
    const entries = await reader.getRecent(count);

    if (entries.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📝 No Logs Found')
        .setDescription('No log entries available yet.');
      return embed;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
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

    return embed;
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
