/**
 * Configuration validator
 */

class ConfigValidator {
  /**
   * Validate entire configuration
   */
  validate(config) {
    const errors = [];

    // Validate Pterodactyl configuration
    if (!config.pterodactyl) {
      errors.push('Missing pterodactyl configuration');
    } else {
      if (!config.pterodactyl.panel_url) {
        errors.push('Missing pterodactyl.panel_url');
      } else if (!this.isValidUrl(config.pterodactyl.panel_url)) {
        errors.push('Invalid pterodactyl.panel_url');
      }

      if (!config.pterodactyl.api_key) {
        errors.push('Missing pterodactyl.api_key');
      }

      if (!config.pterodactyl.server_id) {
        errors.push('Missing pterodactyl.server_id');
      }
    }

    // Validate backup configuration
    if (!config.backup) {
      errors.push('Missing backup configuration');
    } else {
      if (!config.backup.source_path) {
        errors.push('Missing backup.source_path');
      }

      if (!config.backup.backup_dir) {
        errors.push('Missing backup.backup_dir');
      }

      if (config.backup.retention_local_days === undefined) {
        errors.push('Missing backup.retention_local_days');
      } else if (!this.isPositiveInteger(config.backup.retention_local_days)) {
        errors.push('backup.retention_local_days must be a positive integer');
      }

      // Validate max_backup_size_gb if provided
      if (config.backup.max_backup_size_gb !== undefined) {
        if (!this.isPositiveNumber(config.backup.max_backup_size_gb)) {
          errors.push('backup.max_backup_size_gb must be a positive number');
        }
      }

      // Validate container path if use_container_path is enabled
      if (config.backup.use_container_path && !config.backup.container_path) {
        errors.push('backup.container_path is required when use_container_path is true');
      }

      if (!config.backup.cron_schedules || !Array.isArray(config.backup.cron_schedules)) {
        errors.push('backup.cron_schedules must be an array');
      } else {
        config.backup.cron_schedules.forEach((schedule, index) => {
          if (!this.isValidCron(schedule)) {
            errors.push(`Invalid cron schedule at index ${index}: ${schedule}`);
          }
        });
      }
    }

    // Validate rclone configuration
    if (config.rclone) {
      if (config.rclone.enabled) {
        if (!config.rclone.remote_name) {
          errors.push('Missing rclone.remote_name when rclone is enabled');
        }

        if (config.rclone.retention_offsite_days === undefined) {
          errors.push('Missing rclone.retention_offsite_days');
        } else if (!this.isPositiveInteger(config.rclone.retention_offsite_days)) {
          errors.push('rclone.retention_offsite_days must be a positive integer');
        }
      }
    }

    // Validate Discord configuration
    if (!config.discord) {
      errors.push('Missing discord configuration');
    } else {
      if (!config.discord.bot_token) {
        errors.push('Missing discord.bot_token');
      }

      if (!config.discord.guild_id) {
        errors.push('Missing discord.guild_id');
      }

      if (!config.discord.notification_channel_id) {
        errors.push('Missing discord.notification_channel_id');
      }

      if (!config.discord.allowed_roles_backup || !Array.isArray(config.discord.allowed_roles_backup)) {
        errors.push('discord.allowed_roles_backup must be an array');
      }

      if (!config.discord.allowed_roles_restore || !Array.isArray(config.discord.allowed_roles_restore)) {
        errors.push('discord.allowed_roles_restore must be an array');
      }
    }

    // Validate audit configuration
    if (config.audit) {
      if (!config.audit.log_path) {
        errors.push('Missing audit.log_path');
      }

      if (config.audit.retention_days !== undefined && !this.isPositiveInteger(config.audit.retention_days)) {
        errors.push('audit.retention_days must be a positive integer');
      }
    }

    // Validate alerts configuration
    if (config.alerts) {
      if (config.alerts.disk_usage_warning !== undefined) {
        if (!this.isPercentage(config.alerts.disk_usage_warning)) {
          errors.push('alerts.disk_usage_warning must be between 0 and 100');
        }
      }

      if (config.alerts.disk_usage_critical !== undefined) {
        if (!this.isPercentage(config.alerts.disk_usage_critical)) {
          errors.push('alerts.disk_usage_critical must be between 0 and 100');
        }
      }

      if (config.alerts.disk_usage_warning && config.alerts.disk_usage_critical) {
        if (config.alerts.disk_usage_warning >= config.alerts.disk_usage_critical) {
          errors.push('alerts.disk_usage_warning must be less than disk_usage_critical');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate URL format
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate positive integer
   */
  isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
  }

  /**
   * Validate positive number (including decimals)
   */
  isPositiveNumber(value) {
    return typeof value === 'number' && value > 0;
  }

  /**
   * Validate percentage (0-100)
   */
  isPercentage(value) {
    return typeof value === 'number' && value >= 0 && value <= 100;
  }

  /**
   * Basic cron expression validation
   */
  isValidCron(expression) {
    if (typeof expression !== 'string') {
      return false;
    }

    const parts = expression.trim().split(/\s+/);

    // Standard cron has 5 or 6 parts
    if (parts.length < 5 || parts.length > 6) {
      return false;
    }

    // Basic validation (this is simplified)
    const patterns = [
      /^(\*|[0-9,\-*/]+)$/, // Minute
      /^(\*|[0-9,\-*/]+)$/, // Hour
      /^(\*|[0-9,\-*/]+)$/, // Day of month
      /^(\*|[0-9,\-*/]+)$/, // Month
      /^(\*|[0-9,\-*/]+)$/  // Day of week
    ];

    for (let i = 0; i < Math.min(5, parts.length); i++) {
      if (!patterns[i].test(parts[i])) {
        return false;
      }
    }

    return true;
  }
}

module.exports = new ConfigValidator();
