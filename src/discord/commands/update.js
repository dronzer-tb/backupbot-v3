/**
 * Update command - Check for and install backupbot updates
 */

const { EmbedBuilder } = require('discord.js');
const { execSync } = require('child_process');
const fs = require('fs-extra');

class UpdateCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'update';
    this.description = 'Check for and install backupbot updates';
    this.requiredRoles = 'restore'; // Admin only
  }

  /**
   * Execute slash command
   */
  async executeSlash(interaction) {
    const action = interaction.options.getString('action');

    await interaction.deferReply();

    try {
      switch (action) {
        case 'check':
          await this.checkForUpdates(interaction);
          break;
        case 'install':
          await this.installUpdate(interaction);
          break;
        case 'changelog':
          await this.viewChangelog(interaction);
          break;
        default:
          await interaction.editReply('❌ Invalid action');
      }
    } catch (error) {
      await interaction.editReply(`❌ Error: ${error.message}`);
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(interaction) {
    try {
      const output = execSync('sudo /opt/mc-backup/scripts/auto-update.sh check', {
        encoding: 'utf8',
        timeout: 30000
      });

      const hasUpdate = output.includes('UPDATE_AVAILABLE');
      
      if (hasUpdate) {
        // Extract version info
        const match = output.match(/Current: (v[\d.]+).*Available: (v[\d.]+)/s);
        const currentVersion = match ? match[1] : 'Unknown';
        const availableVersion = match ? match[2] : 'Unknown';

        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle('🔔 Update Available!')
          .setDescription('A new version of BackupBot is available!')
          .addFields(
            { name: 'Current Version', value: currentVersion, inline: true },
            { name: 'Available Version', value: availableVersion, inline: true }
          )
          .setFooter({ text: 'Use /update action:install to update' })
          .setTimestamp();

        const row = this.bot.createConfirmButtons('confirm_update');
        
        await interaction.editReply({ 
          embeds: [embed],
          components: [row]
        });
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Up to Date')
          .setDescription('You are running the latest version of BackupBot!')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      throw new Error(`Failed to check for updates: ${error.message}`);
    }
  }

  /**
   * Install update
   */
  async installUpdate(interaction) {
    try {
      await interaction.editReply('🔄 Installing update... This may take a minute.');

      const output = execSync('sudo /opt/mc-backup/scripts/auto-update.sh install', {
        encoding: 'utf8',
        timeout: 120000 // 2 minutes
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Update Installed')
        .setDescription('BackupBot has been successfully updated!')
        .addFields(
          { name: 'Output', value: `\`\`\`${output.substring(0, 900)}\`\`\`` }
        )
        .setFooter({ text: 'The service has been restarted automatically' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      throw new Error(`Failed to install update: ${error.message}`);
    }
  }

  /**
   * View changelog
   */
  async viewChangelog(interaction) {
    try {
      const changelogPath = '/opt/mc-backup/CHANGELOG.md';
      
      if (await fs.pathExists(changelogPath)) {
        const changelog = await fs.readFile(changelogPath, 'utf8');
        
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('📋 Changelog')
          .setDescription(changelog.substring(0, 4000))
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply('❌ Changelog not available');
      }
    } catch (error) {
      throw new Error(`Failed to read changelog: ${error.message}`);
    }
  }

  /**
   * Execute legacy text command
   */
  async execute(message, args) {
    await message.reply('💡 Please use the slash command instead: `/update`');
  }
}

module.exports = UpdateCommand;
