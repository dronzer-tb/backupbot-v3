/**
 * Discord bot initialization with Slash Commands and Buttons
 */

const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../audit/logger');

class DiscordBot {
  constructor(config, backupEngine, restoreEngine, offsiteManager = null) {
    this.config = config;
    this.backupEngine = backupEngine;
    this.restoreEngine = restoreEngine;
    this.offsiteManager = offsiteManager;

    // Create Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Command collection
    this.commands = new Collection();

    // Pending confirmations
    this.pendingConfirmations = new Map();
  }

  /**
   * Initialize bot
   */
  async init() {
    try {
      // Load commands
      await this.loadCommands();

      // Set up event handlers
      this.setupEventHandlers();

      // Login to Discord
      await this.client.login(this.config.discord.bot_token);

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize Discord bot: ${error.message}`);
    }
  }

  /**
   * Load command handlers
   */
  async loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');

    if (!await fs.pathExists(commandsPath)) {
      console.log('Commands directory not found, skipping command loading');
      return;
    }

    const commandFiles = (await fs.readdir(commandsPath))
      .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const CommandClass = require(path.join(commandsPath, file));
      const command = new CommandClass(this);
      this.commands.set(command.name, command);

      console.log(`Loaded command: ${command.name}`);
    }
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`Discord bot logged in as ${this.client.user.tag}`);
      logger.logServiceEvent('DISCORD_BOT_CONNECTED', {
        username: this.client.user.tag
      });
    });

    // Handle slash commands
    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      }
    });

    // Keep legacy text commands for backward compatibility
    this.client.on('messageCreate', async (message) => {
      await this.handleMessage(message);
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
      logger.error('DISCORD_ERROR', 'system', { error: error.message });
    });
  }

  /**
   * Handle slash commands
   */
  async handleSlashCommand(interaction) {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({ content: '❌ Unknown command', ephemeral: true });
      return;
    }

    // Check permissions
    if (!this.checkSlashPermissions(interaction, command.requiredRoles || 'backup')) {
      await interaction.reply({ 
        content: '❌ You do not have permission to use this command.',
        ephemeral: true 
      });
      
      logger.logDiscordCommand(interaction.commandName, interaction.user.tag, {
        result: 'permission_denied'
      }, 'failure');
      
      return;
    }

    // Execute command
    try {
      await command.executeSlash(interaction);

      logger.logDiscordCommand(interaction.commandName, interaction.user.tag, {
        options: interaction.options.data
      }, 'success');
    } catch (error) {
      console.error(`Error executing slash command ${interaction.commandName}:`, error);
      
      const errorMessage = `❌ Error executing command: ${error.message}`;
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }

      logger.logDiscordCommand(interaction.commandName, interaction.user.tag, {
        error: error.message
      }, 'failure');
    }
  }

  /**
   * Handle button interactions
   */
  async handleButton(interaction) {
    try {
      const [action, ...params] = interaction.customId.split(':');

      switch (action) {
        case 'confirm_backup':
          await this.handleConfirmBackup(interaction);
          break;
          
        case 'cancel_action':
          await this.handleCancelAction(interaction);
          break;
          
        case 'confirm_restore':
          await this.handleConfirmRestore(interaction, params[0]);
          break;
          
        case 'view_backup_info':
          await this.handleViewBackupInfo(interaction, params[0]);
          break;
          
        case 'confirm_update':
          await this.handleConfirmUpdate(interaction);
          break;
          
        default:
          await interaction.reply({ content: '❌ Unknown button action', ephemeral: true });
      }
    } catch (error) {
      console.error('Button interaction error:', error);
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }

  /**
   * Handle confirm backup button
   */
  async handleConfirmBackup(interaction) {
    await interaction.update({ content: '🔄 Starting backup...', components: [] });
    
    try {
      const result = await this.backupEngine.executeBackup('discord:' + interaction.user.tag);
      
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Backup Completed')
        .addFields(
          { name: 'Backup Name', value: result.backup_name, inline: true },
          { name: 'Duration', value: `${result.duration_ms / 1000}s`, inline: true },
          { name: 'Files Backed Up', value: result.total_files?.toString() || 'N/A', inline: true }
        )
        .setTimestamp();
        
      await interaction.editReply({ content: null, embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ Backup failed: ${error.message}` });
    }
  }

  /**
   * Handle cancel action button
   */
  async handleCancelAction(interaction) {
    await interaction.update({ content: '❌ Action cancelled', components: [] });
  }

  /**
   * Handle confirm restore button
   */
  async handleConfirmRestore(interaction, backupName) {
    await interaction.update({ content: '🔄 Starting restore... This may take a while.', components: [] });
    
    try {
      const result = await this.restoreEngine.restoreBackup(backupName, 'discord:' + interaction.user.tag);
      
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Restore Completed')
        .setDescription(`Successfully restored from backup: **${backupName}**`)
        .addFields(
          { name: 'Duration', value: `${result.duration_ms / 1000}s`, inline: true },
          { name: 'Files Restored', value: result.files_restored?.toString() || 'N/A', inline: true }
        )
        .setTimestamp();
        
      await interaction.editReply({ content: null, embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ Restore failed: ${error.message}` });
    }
  }

  /**
   * Handle view backup info button
   */
  async handleViewBackupInfo(interaction, backupName) {
    // Defer because this might take a moment
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const infoCommand = this.commands.get('info');
      if (infoCommand) {
        await infoCommand.executeSlash(interaction, backupName);
      } else {
        await interaction.editReply('❌ Info command not available');
      }
    } catch (error) {
      await interaction.editReply(`❌ Failed to get backup info: ${error.message}`);
    }
  }

  /**
   * Handle confirm update button
   */
  async handleConfirmUpdate(interaction) {
    await interaction.update({ content: '🔄 Installing update... This may take a minute.', components: [] });
    
    try {
      const { execSync } = require('child_process');
      const output = execSync('sudo /opt/mc-backup/scripts/auto-update.sh install', {
        encoding: 'utf8',
        timeout: 120000 // 2 minute timeout
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Update Installed')
        .setDescription('The backup system has been updated successfully!')
        .addFields(
          { name: 'Output', value: `\`\`\`${output.substring(0, 1000)}\`\`\`` }
        )
        .setTimestamp();
        
      await interaction.editReply({ content: null, embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: `❌ Update failed: ${error.message}` });
    }
  }

  /**
   * Handle incoming messages (legacy text commands)
   */
  async handleMessage(message) {
    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    // Check if message is in configured channel
    if (this.config.discord.command_channel_id &&
        message.channel.id !== this.config.discord.command_channel_id) {
      return;
    }

    // Check for !backup prefix
    if (!message.content.startsWith('!backup')) {
      return;
    }

    // Parse command and args
    const args = message.content.slice('!backup'.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    // If no command, show help
    if (!commandName) {
      await message.reply('💡 This bot now uses slash commands! Type `/` and select a command.\n\nAvailable commands:\n• `/backup` - Create a backup\n• `/status` - Check system status\n• `/list` - List backups\n• `/restore` - Restore from backup\n• `/logs` - View logs\n• `/info` - Backup details\n• `/config` - View configuration\n• `/update` - Check for updates');
      return;
    }

    // Get command
    const command = this.commands.get(commandName);

    if (!command) {
      await message.reply(`Unknown command: ${commandName}. Try using slash commands instead! Type \`/\` to see all available commands.`);
      return;
    }

    // Check permissions
    if (!this.checkPermissions(message.member, command.requiredRoles || 'backup')) {
      await message.reply('❌ You do not have permission to use this command.');

      logger.logDiscordCommand(commandName, message.author.tag, {
        result: 'permission_denied'
      }, 'failure');

      return;
    }

    // Execute command
    try {
      await command.execute(message, args);

      logger.logDiscordCommand(commandName, message.author.tag, {
        args: args.join(' ')
      }, 'success');
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await message.reply(`❌ Error executing command: ${error.message}`);

      logger.logDiscordCommand(commandName, message.author.tag, {
        error: error.message
      }, 'failure');
    }
  }

  /**
   * Check slash command permissions
   */
  checkSlashPermissions(interaction, requiredType) {
    if (!interaction.member) {
      return false;
    }

    let allowedRoles;

    if (requiredType === 'restore') {
      allowedRoles = this.config.discord.allowed_roles_restore || [];
    } else {
      allowedRoles = this.config.discord.allowed_roles_backup || [];
    }

    // Check if user has any of the allowed roles
    return interaction.member.roles.cache.some(role => allowedRoles.includes(role.name));
  }

  /**
   * Check if user has required permissions (legacy)
   */
  checkPermissions(member, requiredType) {
    if (!member) {
      return false;
    }

    let allowedRoles;

    if (requiredType === 'restore') {
      allowedRoles = this.config.discord.allowed_roles_restore || [];
    } else {
      allowedRoles = this.config.discord.allowed_roles_backup || [];
    }

    // Check if user has any of the allowed roles
    return member.roles.cache.some(role => allowedRoles.includes(role.name));
  }

  /**
   * Create confirmation buttons
   */
  createConfirmButtons(action, ...params) {
    const customId = params.length > 0 ? `${action}:${params.join(':')}` : action;
    
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(customId)
          .setLabel('✓ Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel_action')
          .setLabel('✗ Cancel')
          .setStyle(ButtonStyle.Danger)
      );
  }

  /**
   * Send notification to notification channel
   */
  async sendNotification(embed) {
    try {
      const channelId = this.config.discord.notification_channel_id;

      if (!channelId) {
        console.log('No notification channel configured');
        return;
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel) {
        console.error('Notification channel not found');
        return;
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send notification:', error.message);
    }
  }

  /**
   * Get bot client
   */
  getClient() {
    return this.client;
  }

  /**
   * Shutdown bot
   */
  async shutdown() {
    logger.logServiceEvent('DISCORD_BOT_DISCONNECTED');
    await this.client.destroy();
  }
}

module.exports = DiscordBot;
