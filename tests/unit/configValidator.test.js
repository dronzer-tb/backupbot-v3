/**
 * Configuration Validator Unit Tests
 */

const validator = require('../../src/config/validator');

describe('ConfigValidator', () => {
  describe('validate()', () => {
    test('should accept valid configuration', () => {
      const validConfig = {
        pterodactyl: {
          panel_url: 'https://panel.example.com',
          api_key: 'test-api-key',
          server_id: '12345678'
        },
        backup: {
          source_path: '/var/lib/pterodactyl/volumes/SERVER_UUID/world',
          backup_dir: '/backups/minecraft-smp',
          retention_local_days: 10,
          cron_schedules: ['0 0 * * *', '0 12 * * *']
        },
        discord: {
          bot_token: 'test-bot-token',
          guild_id: 'test-guild-id',
          notification_channel_id: 'test-channel-id',
          allowed_roles_backup: ['Admin'],
          allowed_roles_restore: ['Admin']
        }
      };

      const result = validator.validate(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject missing pterodactyl config', () => {
      const invalidConfig = {
        backup: {
          source_path: '/path/to/source',
          backup_dir: '/path/to/backup',
          retention_local_days: 10,
          cron_schedules: ['0 0 * * *']
        },
        discord: {
          bot_token: 'test-token',
          guild_id: 'test-guild',
          notification_channel_id: 'test-channel',
          allowed_roles_backup: ['Admin'],
          allowed_roles_restore: ['Admin']
        }
      };

      const result = validator.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing pterodactyl configuration');
    });

    test('should reject invalid cron schedule', () => {
      const invalidConfig = {
        pterodactyl: {
          panel_url: 'https://panel.example.com',
          api_key: 'test-key',
          server_id: '12345'
        },
        backup: {
          source_path: '/path/to/source',
          backup_dir: '/path/to/backup',
          retention_local_days: 10,
          cron_schedules: ['invalid-cron']
        },
        discord: {
          bot_token: 'test-token',
          guild_id: 'test-guild',
          notification_channel_id: 'test-channel',
          allowed_roles_backup: ['Admin'],
          allowed_roles_restore: ['Admin']
        }
      };

      const result = validator.validate(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid cron schedule'))).toBe(true);
    });

    test('should validate percentage values', () => {
      expect(validator.isPercentage(50)).toBe(true);
      expect(validator.isPercentage(0)).toBe(true);
      expect(validator.isPercentage(100)).toBe(true);
      expect(validator.isPercentage(-1)).toBe(false);
      expect(validator.isPercentage(101)).toBe(false);
    });

    test('should validate URLs', () => {
      expect(validator.isValidUrl('https://example.com')).toBe(true);
      expect(validator.isValidUrl('http://localhost:8080')).toBe(true);
      expect(validator.isValidUrl('not-a-url')).toBe(false);
    });
  });
});

module.exports = {};
