/**
 * Backup command - Create manual backups with button confirmation
 */

const { EmbedBuilder } = require('discord.js');

class BackupCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'backup';
    this.requiredRoles = 'backup';
    this.description = 'Trigger immediate backup';
  }

  /**
   * Execute slash command with button confirmation
   */
  async executeSlash(interaction) {
    try {
      // Check if backup is already running
      const currentJob = this.bot.backupEngine.getCurrentJob();
      
      if (currentJob.running) {
        await interaction.reply({
          content: `❌ A backup is already running: ${currentJob.name} (started ${Math.floor(currentJob.duration / 1000)}s ago)`,
          ephemeral: true
        });
        return;
      }

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🔄 Confirm Backup')
        .setDescription('Click **Confirm** to start a manual backup.\n\n**Note:** Backup is zero-downtime - players can keep playing!')
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

      const row = this.bot.createConfirmButtons('confirm_backup');

      await interaction.reply({ embeds: [embed], components: [row] });

    } catch (error) {
      await interaction.reply({ 
        content: `❌ Error: ${error.message}`,
        ephemeral: true 
      });
    }
  }

  /**
   * Execute legacy text command
   */
  async execute(message, args) {
    try {
      // Check if backup is already running
      const currentJob = this.bot.backupEngine.getCurrentJob();
      
      if (currentJob.running) {
        await message.reply(`❌ A backup is already running: ${currentJob.name} (started ${Math.floor(currentJob.duration / 1000)}s ago)`);
        return;
      }

      // Send initial message
      const statusMessage = await message.reply('⏳ Starting backup... (Zero downtime - players can keep playing!)');

      // Execute backup
      const result = await this.bot.backupEngine.executeBackup(`discord:${message.author.tag}`);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Backup Completed Successfully')
        .addFields(
          { name: 'Backup Name', value: result.backup.name, inline: true },
          { name: 'Duration', value: `${Math.floor(result.backup.duration / 1000)}s`, inline: true },
          { name: 'Total Files', value: result.backup.stats.totalFiles.toString(), inline: true },
          { name: 'Changed Files', value: result.backup.stats.transferredFiles.toString(), inline: true },
          { name: 'Space Saved', value: `${result.backup.compressionRatio}%`, inline: true },
          { name: 'Old Backups Cleaned', value: result.backup.cleanupDeleted.toString(), inline: true }
        )
        .setFooter({ text: `Triggered by ${message.author.tag}` })
        .setTimestamp();

      await statusMessage.edit({ content: '', embeds: [embed] });

      // Send notification to notification channel
      await this.bot.sendNotification(embed);

      // Queue offsite sync if enabled
      if (this.bot.offsiteManager && this.bot.config.rclone?.enabled && this.bot.config.rclone?.sync_after_backup) {
        await this.bot.offsiteManager.queueSync(result.backup.name);
      }

    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Backup Failed')
        .setDescription(error.message)
        .setFooter({ text: `Triggered by ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      // Send failure notification
      await this.bot.sendNotification(embed);
    }
  }
}

module.exports = BackupCommand;
