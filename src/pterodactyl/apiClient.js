/**
 * Pterodactyl API client
 */

const axios = require('axios');
const ErrorHandler = require('../utils/errorHandler');

class PterodactylClient {
  constructor(config) {
    this.panelUrl = config.pterodactyl.panel_url.replace(/\/$/, '');
    this.apiKey = config.pterodactyl.api_key;
    this.serverId = config.pterodactyl.server_id;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: `${this.panelUrl}/api/client`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await this.client.get(`/servers/${this.serverId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get server details
   */
  async getServerDetails() {
    try {
      const response = await this.client.get(`/servers/${this.serverId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get server details: ${error.message}`);
    }
  }

  /**
   * Get server resources (CPU, memory, disk, status)
   */
  async getServerResources() {
    try {
      const response = await this.client.get(`/servers/${this.serverId}/resources`);
      return response.data.attributes;
    } catch (error) {
      throw new Error(`Failed to get server resources: ${error.message}`);
    }
  }

  /**
   * Get server status
   */
  async getServerStatus() {
    try {
      const resources = await this.getServerResources();
      return resources.current_state;
    } catch (error) {
      throw new Error(`Failed to get server status: ${error.message}`);
    }
  }

  /**
   * Send power action to server
   * @param {string} signal - Power signal (start, stop, restart, kill)
   */
  async sendPowerAction(signal) {
    try {
      const response = await this.client.post(
        `/servers/${this.serverId}/power`,
        { signal }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send power action '${signal}': ${error.message}`);
    }
  }

  /**
   * Start server
   */
  async startServer() {
    return this.sendPowerAction('start');
  }

  /**
   * Stop server gracefully
   */
  async stopServer() {
    return this.sendPowerAction('stop');
  }

  /**
   * Kill server (force stop)
   */
  async killServer() {
    return this.sendPowerAction('kill');
  }

  /**
   * Restart server
   */
  async restartServer() {
    return this.sendPowerAction('restart');
  }

  /**
   * Send command to server console
   * @param {string} command - Command to send
   */
  async sendCommand(command) {
    try {
      const response = await this.client.post(
        `/servers/${this.serverId}/command`,
        { command }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to send command '${command}': ${error.message}`);
    }
  }

  /**
   * Send save-all command
   */
  async saveWorld() {
    return this.sendCommand('save-all');
  }

  /**
   * Wait for server to reach a specific state
   * @param {string} targetState - Target state (running, offline, starting, stopping)
   * @param {number} maxWaitTime - Maximum wait time in seconds
   * @param {number} pollInterval - Poll interval in milliseconds
   */
  async waitForState(targetState, maxWaitTime = 60, pollInterval = 2000) {
    const startTime = Date.now();
    const maxWaitMs = maxWaitTime * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const currentState = await this.getServerStatus();
        
        if (currentState === targetState) {
          return true;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error polling server status:', error.message);
      }
    }

    throw new Error(`Timeout waiting for server to reach state '${targetState}'`);
  }

  /**
   * Get server console logs
   */
  async getConsoleLogs() {
    try {
      const response = await this.client.get(`/servers/${this.serverId}/websocket`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get console logs: ${error.message}`);
    }
  }

  /**
   * Check if server is online
   */
  async isServerOnline() {
    try {
      const status = await this.getServerStatus();
      return status === 'running';
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if server is offline
   */
  async isServerOffline() {
    try {
      const status = await this.getServerStatus();
      return status === 'offline';
    } catch (error) {
      return false;
    }
  }
}

module.exports = PterodactylClient;
