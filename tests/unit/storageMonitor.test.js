/**
 * Storage Monitor Unit Tests
 */

const StorageMonitor = require('../../src/storage/monitoring');

describe('StorageMonitor', () => {
  let monitor;
  const mockConfig = {
    backup: {
      backup_dir: '/tmp/test-backups'
    },
    alerts: {
      disk_usage_warning: 80,
      disk_usage_critical: 95
    }
  };

  beforeEach(() => {
    monitor = new StorageMonitor(mockConfig);
  });

  describe('formatBytes()', () => {
    test('should format bytes correctly', () => {
      expect(monitor.formatBytes(0)).toBe('0 B');
      expect(monitor.formatBytes(1024)).toBe('1 KB');
      expect(monitor.formatBytes(1048576)).toBe('1 MB');
      expect(monitor.formatBytes(1073741824)).toBe('1 GB');
      expect(monitor.formatBytes(1099511627776)).toBe('1 TB');
    });

    test('should handle decimal values', () => {
      expect(monitor.formatBytes(1536)).toBe('1.5 KB');
      expect(monitor.formatBytes(2621440)).toBe('2.5 MB');
    });
  });

  describe('threshold checks', () => {
    test('should have correct warning threshold', () => {
      expect(monitor.warningThreshold).toBe(80);
    });

    test('should have correct critical threshold', () => {
      expect(monitor.criticalThreshold).toBe(95);
    });
  });
});

module.exports = {};
