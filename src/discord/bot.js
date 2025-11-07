/**
 * Discord bot initialization
 */

const { Client, GatewayIntentBits, Collection } = require('discord.js');
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

    this.client.on('messageCreate', async (message) => {
      await this.handleMessage(message);
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
      logger.error('DISCORD_ERROR', 'system', { error: error.message });
    });
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;

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
      const helpCommand = this.commands.get('help');
      if (helpCommand) {
        await helpCommand.execute(message, []);
      }
      return;
    }

    // Get command
    const command = this.commands.get(commandName);
    
    if (!command) {
      await message.reply(`Unknown command: ${commandName}. Use \`!backup help\` for available commands.`);
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
   * Check if user has required permissions
   */
  checkPermissions(member, requiredType) {
    if (!member) return false;

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
