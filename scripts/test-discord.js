/**
 * Test Discord bot connection
 */

const { Client, GatewayIntentBits } = require('discord.js');
const ConfigManager = require('../src/config/configManager');

async function testDiscord() {
  try {
    console.log('Testing Discord bot connection...\n');

    // Load config
    const configManager = ConfigManager.getInstance();
    const config = await configManager.load();

    console.log(`Guild ID: ${config.discord.guild_id}`);
    console.log(`Notification Channel: ${config.discord.notification_channel_id}\n`);

    // Create client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Set up event handlers
    client.once('ready', async () => {
      console.log(`✅ Connected as ${client.user.tag}\n`);

      try {
        // Test guild access
        console.log('Testing guild access...');
        const guild = await client.guilds.fetch(config.discord.guild_id);
        console.log(`✅ Guild found: ${guild.name}\n`);

        // Test notification channel access
        console.log('Testing notification channel access...');
        const channel = await client.channels.fetch(config.discord.notification_channel_id);
        console.log(`✅ Channel found: ${channel.name}\n`);

        // List roles
        console.log('Available roles:');
        guild.roles.cache.forEach(role => {
          if (role.name !== '@everyone') {
            console.log(`  - ${role.name}`);
          }
        });

        console.log('\n✅ All tests passed!');
        console.log('Bot is ready to use.');

        process.exit(0);
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
      }
    });

    client.on('error', (error) => {
      console.error(`❌ Discord client error: ${error.message}`);
      process.exit(1);
    });

    // Login
    console.log('Connecting to Discord...');
    await client.login(config.discord.bot_token);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

testDiscord();
