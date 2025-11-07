/**
 * Manual backup script (one-off backup)
 */

const { ConfigManager } = require('../src/config/configManager');
const logger = require('../src/audit/logger');
const PterodactylClient = require('../src/pterodactyl/apiClient');
const ServerControl = require('../src/pterodactyl/serverControl');
const BackupEngine = require('../src/backup/backupEngine');

async function runManualBackup() {
  try {
    console.log('🚀 Starting manual backup...\n');

    // Load config
    console.log('📝 Loading configuration...');
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();
    console.log('✅ Configuration loaded\n');

    // Initialize logger
    console.log('📋 Initializing logger...');
    logger.init(config);
    console.log('✅ Logger initialized\n');

    // Initialize Pterodactyl client
    console.log('🔧 Connecting to Pterodactyl...');
    const pterodactylClient = new PterodactylClient(config);
    const serverControl = new ServerControl(pterodactylClient);
    console.log('✅ Connected to Pterodactyl\n');

    // Initialize backup engine
    console.log('💾 Initializing backup engine...');
    const backupEngine = new BackupEngine(config, serverControl);
    console.log('✅ Backup engine initialized\n');

    // Execute backup
    console.log('🔄 Starting backup...');
    const result = await backupEngine.executeBackup('manual');

    console.log('\n✅ Backup completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Backup Name: ${result.backup.name}`);
    console.log(`Duration: ${Math.floor(result.backup.duration / 1000)}s`);
    console.log(`Total Files: ${result.backup.stats.totalFiles}`);
    console.log(`Changed Files: ${result.backup.stats.transferredFiles}`);
    console.log(`Space Saved: ${result.backup.compressionRatio}%`);
    console.log(`Old Backups Cleaned: ${result.backup.cleanupDeleted}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error(`\n❌ Backup failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

runManualBackup();
