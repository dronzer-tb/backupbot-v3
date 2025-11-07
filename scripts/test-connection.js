/**
 * Test Pterodactyl API connection
 */

const { ConfigManager } = require('../src/config/configManager');
const PterodactylClient = require('../src/pterodactyl/apiClient');

async function testConnection() {
  try {
    console.log('Testing Pterodactyl API connection...\n');

    // Load config
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();

    console.log(`Panel URL: ${config.pterodactyl.panel_url}`);
    console.log(`Server ID: ${config.pterodactyl.server_id}\n`);

    // Create client
    const client = new PterodactylClient(config);

    // Test connection
    console.log('Testing connection...');
    const result = await client.testConnection();

    if (result.success) {
      console.log('✅ Connection successful!\n');

      // Get server details
      console.log('Fetching server details...');
      const details = await client.getServerDetails();
      console.log(`Server Name: ${details.attributes.name}`);
      console.log(`Server UUID: ${details.attributes.uuid}\n`);

      // Get server status
      console.log('Fetching server status...');
      const status = await client.getServerStatus();
      console.log(`Current State: ${status}\n`);

      // Get server resources
      console.log('Fetching server resources...');
      const resources = await client.getServerResources();
      console.log(`CPU: ${resources.cpu_absolute}%`);
      console.log(`Memory: ${Math.round(resources.memory_bytes / 1024 / 1024)}MB`);
      console.log(`Disk: ${Math.round(resources.disk_bytes / 1024 / 1024)}MB\n`);

      console.log('✅ All tests passed!');
    } else {
      console.log(`❌ Connection failed: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

testConnection();
