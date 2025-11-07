/**
 * !backup cancel command
 */

const { EmbedBuilder } = require('discord.js');

class CancelCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'cancel';
    this.requiredRoles = 'restore'; // Admin only
    this.description = 'Cancel ongoing backup';
  }

  async executeSlash(interaction) {
    await this.execute({ reply: interaction.reply.bind(interaction) }, []);
  }

  async execute(message, args) {
    try {
      const currentJob = this.bot.backupEngine.getCurrentJob();
      
      if (!currentJob.running) {
        await message.reply('❌ No backup is currently running.');
        return;
      }

      // Cancel backup
      await this.bot.backupEngine.cancelBackup(`discord:${message.author.tag}`);

      const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('⚠️ Backup Cancelled')
        .setDescription(`Backup **${currentJob.name}** has been cancelled.`)
        .setFooter({ text: `Cancelled by ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      // Send notification
      await this.bot.sendNotification(embed);

    } catch (error) {
      await message.reply(`❌ Error cancelling backup: ${error.message}`);
    }
  }
}

module.exports = CancelCommand;
