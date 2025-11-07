/**
 * Minecraft Backup System - Main Entry Point
 * 
 * A standalone Node.js application for automating Minecraft world backups
 * with offsite replication and Discord-based management.
 */

const ConfigManager = require('./config/configManager');
const logger = require('./audit/logger');
const PterodactylClient = require('./pterodactyl/apiClient');
const ServerControl = require('./pterodactyl/serverControl');
const BackupEngine = require('./backup/backupEngine');
const BackupScheduler = require('./backup/scheduler');
const RestoreEngine = require('./restore/restoreEngine');
const DiscordBot = require('./discord/bot');
const ErrorHandler = require('./utils/errorHandler');

class MinecraftBackupSystem {
  constructor() {
    this.config = null;
    this.logger = null;
    this.pterodactylClient = null;
    this.serverControl = null;
    this.backupEngine = null;
    this.scheduler = null;
    this.restoreEngine = null;
    this.discordBot = null;
    this.offsiteManager = null;
  }

  /**
   * Initialize the backup system
   */
  async init() {
    try {
      console.log('🚀 Starting Minecraft Backup System...\n');

      // Step 1: Load configuration
      console.log('📝 Loading configuration...');
      const configManager = ConfigManager.getInstance();
      this.config = await configManager.load();
      console.log('✅ Configuration loaded\n');

      // Step 2: Initialize logger
      console.log('📋 Initializing audit logger...');
      this.logger = logger.init(this.config);
      console.log('✅ Audit logger initialized\n');

      // Log service start
      logger.logServiceEvent('SERVICE_STARTED', {
        version: '1.0.0',
        node_version: process.version
      });

      // Step 3: Initialize Pterodactyl client
      console.log('🔧 Connecting to Pterodactyl panel...');
      this.pterodactylClient = new PterodactylClient(this.config);
      
      const connectionTest = await this.pterodactylClient.testConnection();
      if (!connectionTest.success) {
        throw new Error(`Failed to connect to Pterodactyl: ${connectionTest.error}`);
      }
      
      console.log('✅ Connected to Pterodactyl panel\n');

      // Step 4: Initialize server control
      console.log('🎮 Initializing server control...');
      this.serverControl = new ServerControl(this.pterodactylClient);
      console.log('✅ Server control initialized\n');

      // Step 5: Initialize backup engine
      console.log('💾 Initializing backup engine...');
      this.backupEngine = new BackupEngine(this.config, this.serverControl);
      console.log('✅ Backup engine initialized\n');

      // Step 6: Initialize restore engine
      console.log('🔄 Initializing restore engine...');
      this.restoreEngine = new RestoreEngine(this.config, this.serverControl);
      console.log('✅ Restore engine initialized\n');

      // Step 7: Initialize offsite manager (if enabled)
      if (this.config.rclone?.enabled) {
        console.log('☁️  Initializing offsite backup manager...');
        // TODO: Implement offsite manager
        console.log('⚠️  Offsite backup manager not implemented yet\n');
      }

      // Step 8: Initialize Discord bot
      console.log('🤖 Initializing Discord bot...');
      this.discordBot = new DiscordBot(
        this.config,
        this.backupEngine,
        this.restoreEngine,
        this.offsiteManager
      );
      await this.discordBot.init();
      console.log('✅ Discord bot connected\n');

      // Step 9: Initialize and start scheduler
      console.log('⏰ Starting backup scheduler...');
      this.scheduler = new BackupScheduler(this.config, this.backupEngine);
      this.backupEngine.scheduler = this.scheduler; // Add reference
      this.scheduler.start();
      console.log('✅ Backup scheduler started\n');

      // Setup signal handlers
      this.setupSignalHandlers();

      console.log('✅ Minecraft Backup System is now running!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 System Information:');
      console.log(`   Server ID: ${this.config.pterodactyl.server_id}`);
      console.log(`   Backup Directory: ${this.config.backup.backup_dir}`);
      console.log(`   Retention: ${this.config.backup.retention_local_days} days`);
      console.log(`   Schedules: ${this.config.backup.cron_schedules.length} active`);
      console.log(`   Offsite: ${this.config.rclone?.enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('💡 Use Discord commands (!backup help) to manage backups\n');

    } catch (error) {
      console.error('❌ Failed to initialize backup system:', error.message);
      await ErrorHandler.handle(error, 'Initialization', true);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const shutdown = async (signal) => {
      console.log(`\n\n⚠️  Received ${signal}, shutting down gracefully...`);
      
      try {
        // Stop scheduler
        if (this.scheduler) {
          console.log('⏰ Stopping scheduler...');
          this.scheduler.stop();
        }

        // Shutdown Discord bot
        if (this.discordBot) {
          console.log('🤖 Disconnecting Discord bot...');
          await this.discordBot.shutdown();
        }

        // Log service stop
        logger.logServiceEvent('SERVICE_STOPPED', {
          signal
        });

        console.log('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught exception:', error);
      await ErrorHandler.handle(error, 'UncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled promise rejection:', reason);
      await ErrorHandler.handle(
        new Error(`Unhandled rejection: ${reason}`),
        'UnhandledRejection'
      );
    });
  }

  /**
   * Get system status
   */
  async getStatus() {
    try {
      const backupStats = await this.backupEngine.getStats();
      const serverStatus = await this.serverControl.getStatus();
      const schedulerStatus = this.scheduler.getStatus();

      return {
        running: true,
        backup: backupStats,
        server: serverStatus,
        scheduler: schedulerStatus,
        offsite: this.config.rclone?.enabled || false
      };
    } catch (error) {
      return {
        running: false,
        error: error.message
      };
    }
  }
}

// Create and start the system
const system = new MinecraftBackupSystem();

// Start the system
system.init().catch(async (error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Export for testing
module.exports = MinecraftBackupSystem;
