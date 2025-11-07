/**
 * Deploy slash commands to Discord
 */

const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

async function deployCommands() {
  try {
    // Load config
    const configPath = process.env.CONFIG_PATH || '/etc/mc-backup/config.json';
    const config = await fs.readJSON(configPath);

    const commands = [
      // Backup command
      new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Create a manual backup of the Minecraft server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      // Status command
      new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check backup system status'),

      // List command
      new SlashCommandBuilder()
        .setName('list')
        .setDescription('List available backups')
        .addIntegerOption(option =>
          option.setName('count')
            .setDescription('Number of backups to show (default: 10)')
            .setMinValue(1)
            .setMaxValue(50)
        ),

      // Restore command
      new SlashCommandBuilder()
        .setName('restore')
        .setDescription('Restore from a backup')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
          option.setName('backup')
            .setDescription('Backup name (use /list to see available backups)')
            .setRequired(true)
        ),

      // Logs command
      new SlashCommandBuilder()
        .setName('logs')
        .setDescription('View recent backup logs')
        .addIntegerOption(option =>
          option.setName('count')
            .setDescription('Number of log entries (default: 20)')
            .setMinValue(5)
            .setMaxValue(100)
        ),

      // Info command
      new SlashCommandBuilder()
        .setName('info')
        .setDescription('Show detailed information about a backup')
        .addStringOption(option =>
          option.setName('backup')
            .setDescription('Backup name')
            .setRequired(true)
        ),

      // Config command
      new SlashCommandBuilder()
        .setName('config')
        .setDescription('View current backup configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      // Cancel command
      new SlashCommandBuilder()
        .setName('cancel')
        .setDescription('Cancel a running backup operation')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      // Update command (NEW!)
      new SlashCommandBuilder()
        .setName('update')
        .setDescription('Check for and install backupbot updates')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
          option.setName('action')
            .setDescription('Update action')
            .setRequired(true)
            .addChoices(
              { name: 'Check for updates', value: 'check' },
              { name: 'Install update', value: 'install' },
              { name: 'View changelog', value: 'changelog' }
            )
        )
    ];

    const rest = new REST({ version: '10' }).setToken(config.discord.bot_token);

    console.log('Deploying slash commands to Discord...');

    await rest.put(
      Routes.applicationCommands(config.discord.client_id),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    console.log('✓ Successfully deployed slash commands!');
    console.log(`✓ Registered ${commands.length} commands`);
    
    return true;
  } catch (error) {
    console.error('Failed to deploy commands:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  deployCommands()
    .then(success => process.exit(success ? 0 : 1))
    .catch(() => process.exit(1));
}

module.exports = { deployCommands };
