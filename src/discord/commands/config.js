/**
 * !backup config command
 */

const { EmbedBuilder } = require('discord.js');

class ConfigCommand {
  constructor(bot) {
    this.bot = bot;
    this.name = 'config';
    this.requiredRoles = 'backup';
    this.description = 'Display current configuration';
  }

  async executeSlash(interaction) {
    await this.execute(interaction);
  }

  async execute(message, args) {
    try {
      const configManager = require('../../config/configManager').getInstance();
      const maskedConfig = configManager.getMasked();

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('⚙️ System Configuration')
        .setDescription('Current backup system settings (sensitive values masked)')
        .addFields(
          { 
            name: '🔧 Pterodactyl',
            value: `Panel: ${maskedConfig.pterodactyl.panel_url}\nServer ID: ${maskedConfig.pterodactyl.server_id}`,
            inline: false
          },
          { 
            name: '💾 Backup Settings',
            value: `Source: ${maskedConfig.backup.source_path}\nBackup Dir: ${maskedConfig.backup.backup_dir}\nRetention: ${maskedConfig.backup.retention_local_days} days\nSchedules: ${maskedConfig.backup.cron_schedules.length} active`,
            inline: false
          },
          { 
            name: '📊 Storage Alerts',
            value: `Warning: ${maskedConfig.alerts.disk_usage_warning}%\nCritical: ${maskedConfig.alerts.disk_usage_critical}%`,
            inline: false
          }
        )
        .setTimestamp();

      // Add offsite info if enabled
      if (maskedConfig.rclone?.enabled) {
        embed.addFields({
          name: '☁️ Offsite Backup',
          value: `Enabled: ✅\nRemote: ${maskedConfig.rclone.remote_name}\nRetention: ${maskedConfig.rclone.retention_offsite_days} days`,
          inline: false
        });
      } else {
        embed.addFields({
          name: '☁️ Offsite Backup',
          value: 'Disabled: ❌',
          inline: false
        });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      await message.reply(`❌ Error reading configuration: ${error.message}`);
    }
  }
}

module.exports = ConfigCommand;
