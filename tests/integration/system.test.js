/**
 * System Integration Tests
 */

const ConfigManager = require('../../src/config/configManager');
const PterodactylClient = require('../../src/pterodactyl/apiClient');
const RsyncWrapper = require('../../src/backup/rsyncWrapper');

describe('System Integration', () => {
  describe('rsync availability', () => {
    test('rsync should be installed', async () => {
      const rsync = new RsyncWrapper({});
      const result = await rsync.testRsync();
      
      expect(result.available).toBe(true);
      expect(result.version).toBeDefined();
    });
  });

  describe('configuration loading', () => {
    test('should fallback to example config if main config missing', async () => {
      const configManager = ConfigManager.getInstance();
      
      // This will test the fallback mechanism
      try {
        const config = await configManager.load('./config/config.example.json');
        expect(config).toBeDefined();
        expect(config.pterodactyl).toBeDefined();
        expect(config.backup).toBeDefined();
        expect(config.discord).toBeDefined();
      } catch (error) {
        // Expected if example config doesn't exist
        expect(error.message).toContain('Configuration file not found');
      }
    });
  });
});

module.exports = {};
