/**
 * Pterodactyl server control logic
 */

const logger = require('../audit/logger');
const ErrorHandler = require('../utils/errorHandler');

class ServerControl {
  constructor(apiClient) {
    this.api = apiClient;
  }

  /**
   * Stop server gracefully
   * @param {string} triggeredBy - Who triggered the stop
   */
  async stopServer(triggeredBy = 'system') {
    try {
      logger.logServerControl('SERVER_STOP_REQUESTED', triggeredBy, {
        server_id: this.api.serverId
      });

      // Send stop command
      await this.api.stopServer();

      // Wait for server to stop (60 second timeout)
      try {
        await this.api.waitForState('offline', 60);

        logger.logServerControl('SERVER_STOPPED', triggeredBy, {
          server_id: this.api.serverId,
          method: 'graceful'
        }, 'success');

        return { success: true, method: 'graceful' };
      } catch (error) {
        // Graceful stop timed out, try force kill
        console.log('Graceful stop timed out, attempting force kill...');

        logger.logServerControl('SERVER_STOP_TIMEOUT', triggeredBy, {
          server_id: this.api.serverId
        }, 'warning');

        await this.api.killServer();
        await this.api.waitForState('offline', 30);

        logger.logServerControl('SERVER_STOPPED', triggeredBy, {
          server_id: this.api.serverId,
          method: 'force'
        }, 'success');

        return { success: true, method: 'force' };
      }
    } catch (error) {
      logger.logServerControl('SERVER_STOP_FAILED', triggeredBy, {
        server_id: this.api.serverId,
        error: error.message
      }, 'failure');

      throw error;
    }
  }

  /**
   * Start server
   * @param {string} triggeredBy - Who triggered the start
   */
  async startServer(triggeredBy = 'system') {
    try {
      logger.logServerControl('SERVER_START_REQUESTED', triggeredBy, {
        server_id: this.api.serverId
      });

      // Send start command
      await this.api.startServer();

      // Wait for server to start
      await this.api.waitForState('running', 60);

      logger.logServerControl('SERVER_STARTED', triggeredBy, {
        server_id: this.api.serverId
      }, 'success');

      return { success: true };
    } catch (error) {
      logger.logServerControl('SERVER_START_FAILED', triggeredBy, {
        server_id: this.api.serverId,
        error: error.message
      }, 'failure');

      throw error;
    }
  }

  /**
   * Restart server
   * @param {string} triggeredBy - Who triggered the restart
   */
  async restartServer(triggeredBy = 'system') {
    await this.stopServer(triggeredBy);

    // Wait a moment before starting
    await new Promise(resolve => setTimeout(resolve, 2000));

    await this.startServer(triggeredBy);

    return { success: true };
  }

  /**
   * Send save-all command (no downtime)
   * @param {string} triggeredBy - Who triggered the save
   * @param {number} waitTime - Time to wait after save-all in milliseconds
   */
  async saveWorld(triggeredBy = 'system', waitTime = 5000) {
    try {
      logger.logServerControl('SAVE_REQUESTED', triggeredBy, {
        server_id: this.api.serverId
      });

      // Check if server is running
      const isOnline = await this.api.isServerOnline();

      if (!isOnline) {
        throw new Error('Server must be running to save world');
      }

      // Send save-all command
      await this.api.saveWorld();

      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, waitTime));

      logger.logServerControl('SAVE_COMPLETED', triggeredBy, {
        server_id: this.api.serverId
      }, 'success');

      return { success: true };
    } catch (error) {
      logger.logServerControl('SAVE_FAILED', triggeredBy, {
        server_id: this.api.serverId,
        error: error.message
      }, 'failure');

      throw error;
    }
  }

  /**
   * Get server status
   */
  async getStatus() {
    try {
      const status = await this.api.getServerStatus();
      const resources = await this.api.getServerResources();

      return {
        state: status,
        cpu: resources.cpu_absolute,
        memory: {
          current: resources.memory_bytes,
          limit: resources.memory_limit_bytes
        },
        disk: {
          current: resources.disk_bytes,
          limit: resources.disk_limit_bytes
        },
        uptime: resources.uptime
      };
    } catch (error) {
      throw new Error(`Failed to get server status: ${error.message}`);
    }
  }

  /**
   * Check if server is ready for backup
   */
  async isReadyForBackup() {
    try {
      const status = await this.api.getServerStatus();
      return status === 'running';
    } catch (error) {
      return false;
    }
  }

  /**
   * Prepare for backup (save world)
   */
  async prepareForBackup(triggeredBy = 'system') {
    return this.saveWorld(triggeredBy);
  }
}

module.exports = ServerControl;
