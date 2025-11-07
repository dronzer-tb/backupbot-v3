/**
 * !backup restore command
 */

const { EmbedBuilder } = require('discord.js');

class RestoreCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'restore';
    this.requiredRoles = 'restore'; // Admin only
    this.description = 'Restore a specific backup';
  }

  async executeSlash(interaction) {
    const backupName = interaction.options.getString('backup');
    await this.execute({ reply: interaction.reply.bind(interaction), author: interaction.user }, [backupName]);
  }

  async execute(message, args) {
    try {
      // Check if backup name is provided
      if (args.length === 0) {
        await message.reply('❌ Please specify a backup name. Use `!backup list` to see available backups.');
        return;
      }

      const backupName = args[0];

      // Check if restore is already running
      const currentRestore = this.bot.restoreEngine.getCurrentRestore();
      
      if (currentRestore.running) {
        await message.reply(`❌ A restore is already running: ${currentRestore.backupName}`);
        return;
      }

      // Check if backup is already running
      const currentJob = this.bot.backupEngine.getCurrentJob();
      
      if (currentJob.running) {
        await message.reply(`❌ Cannot restore while backup is running: ${currentJob.name}`);
        return;
      }

      // Send confirmation request
      const confirmEmbed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('⚠️ Restore Confirmation Required')
        .setDescription(`You are about to restore backup: **${backupName}**`)
        .addFields(
          { name: 'Warning', value: '🛑 The server will be stopped during restore!', inline: false },
          { name: 'Safety', value: '📸 A pre-restore snapshot will be created automatically', inline: false },
          { name: 'Action Required', value: 'Type **CONFIRM** within 30 seconds to proceed, or **CANCEL** to abort', inline: false }
        )
        .setFooter({ text: 'This action requires admin permissions' });

      await message.reply({ embeds: [confirmEmbed] });

      // Wait for confirmation
      const filter = m => m.author.id === message.author.id && 
                          (m.content.toUpperCase() === 'CONFIRM' || m.content.toUpperCase() === 'CANCEL');

      try {
        const collected = await message.channel.awaitMessages({
          filter,
          max: 1,
          time: 30000,
          errors: ['time']
        });

        const response = collected.first();

        if (response.content.toUpperCase() === 'CANCEL') {
          await message.reply('✅ Restore cancelled.');
          return;
        }

        // User confirmed, start restore
        const statusMessage = await message.reply('⏳ Starting restore... This will take a few minutes.');

        const result = await this.bot.restoreEngine.restoreBackup(
          backupName,
          `discord:${message.author.tag}`
        );

        // Create success embed
        const successEmbed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('✅ Restore Completed Successfully')
          .addFields(
            { name: 'Restored Backup', value: result.backupName, inline: true },
            { name: 'Duration', value: `${Math.floor(result.duration / 1000)}s`, inline: true },
            { name: 'Pre-Restore Snapshot', value: result.snapshotName, inline: false },
            { name: 'Total Files', value: result.stats.totalFiles.toString(), inline: true },
            { name: 'Server Status', value: '🟢 Running', inline: true }
          )
          .setFooter({ text: `Restored by ${message.author.tag}` })
          .setTimestamp();

        await statusMessage.edit({ content: '', embeds: [successEmbed] });

        // Send notification
        await this.bot.sendNotification(successEmbed);

      } catch (error) {
        if (error.message === 'time') {
          await message.reply('❌ Restore cancelled - confirmation timeout (30s)');
        } else {
          throw error;
        }
      }

    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Restore Failed')
        .setDescription(error.message)
        .setFooter({ text: `Attempted by ${message.author.tag}` })
        .setTimestamp();

      await message.reply({ embeds: [errorEmbed] });

      // Send failure notification
      await this.bot.sendNotification(errorEmbed);
    }
  }
}

module.exports = RestoreCommand;
