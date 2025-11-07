# Minecraft SMP Backup System

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)

A standalone Node.js application running at the VPS host level to automate Minecraft world backups with offsite replication and Discord-based management.

## ✨ Features

- **Zero-Downtime Backups** - Uses `save-all` command instead of stopping the server
- **Incremental Backups** - rsync with `--link-dest` for space-efficient backups (95%+ space savings)
- **Automated Scheduling** - Cron-based backup scheduling
- **Discord Bot Integration** - Full backup management through Discord commands
- **Offsite Replication** - Optional rclone integration for cloud backup
- **Pre-Restore Snapshots** - Automatic safety snapshots before restores
- **Comprehensive Audit Logging** - JSON Lines format with full event tracking
- **Storage Monitoring** - Automatic disk usage alerts
- **Retention Policies** - Configurable local and offsite retention
- **SHA-256 Verification** - Integrity checking for all backups
- **One-Command Installation** - Automated deployment with interactive wizard

## 🚀 Quick Start

### One-Line Installation (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | sudo bash
```

The interactive installation wizard will guide you through:
- ✅ Pterodactyl API configuration with connection testing
- ✅ Backup schedule setup (5 presets + custom cron)
- ✅ Optional offsite backup configuration (rclone)
- ✅ Discord bot integration with role-based permissions
- ✅ Storage alerts and retention policies
- ✅ Automatic service installation and startup

**Installation completes in ~5 minutes** with zero manual configuration!

### Manual Setup

1. **Clone the repository**
```bash
git clone https://github.com/dronzer-tb/backupbot-v3.git
cd backupbot-v3
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure the system**
```bash
cp config/config.example.json config/config.json
nano config/config.json
```

4. **Start the service**
```bash
npm start
```

## 📋 Requirements

- **Node.js** 18+ LTS
- **rsync** (for backups)
- **Pterodactyl Panel** with API access
- **Discord Bot** with permissions
- **Optional**: rclone (for offsite backups)
- **Linux OS**: Ubuntu 20.04+, Debian 11+, or CentOS 8+

## 🎮 Discord Commands

All commands use the `!backup` prefix:

| Command | Description | Permission |
|---------|-------------|------------|
| `!backup now` | Trigger immediate backup (zero downtime) | Backup Role |
| `!backup list [local\|offsite\|all]` | List available backups | Backup Role |
| `!backup restore <backup_id>` | Restore a specific backup | Admin Role |
| `!backup status` | Show current backup status | Backup Role |
| `!backup logs [count]` | Display recent audit logs | Backup Role |
| `!backup info <backup_id>` | Show detailed backup information | Backup Role |
| `!backup cancel` | Cancel ongoing backup | Admin Role |
| `!backup config` | Display current configuration | Backup Role |
| `!backup help` | Show available commands | Backup Role |

### Optional Commands
| Command | Description | Availability |
|---------|-------------|--------------|
| `!backup offsite` | Force offsite sync | If rclone enabled |

## ⚙️ Configuration

Configuration is stored in `/etc/mc-backup/config.json` (or `./config/config.json`).

### Example Configuration

```json
{
  "pterodactyl": {
    "panel_url": "https://panel.example.com",
    "api_key": "your_api_key_here",
    "server_id": "12345678"
  },
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/SERVER_UUID/world",
    "backup_dir": "/backups/minecraft-smp",
    "retention_local_days": 10,
    "cron_schedules": [
      "0 0 * * *",
      "0 12 * * *",
      "0 18 * * *"
    ]
  },
  "discord": {
    "bot_token": "your_bot_token_here",
    "guild_id": "your_guild_id",
    "command_channel_id": "channel_id",
    "notification_channel_id": "channel_id",
    "allowed_roles_backup": ["Admin", "Moderator"],
    "allowed_roles_restore": ["Admin"]
  },
  "rclone": {
    "enabled": false,
    "remote_name": "gdrive:minecraft-backups",
    "retention_offsite_days": 30,
    "sync_after_backup": true
  }
}
```

See [CONFIGURATION.md](docs/CONFIGURATION.md) for full configuration reference.

## 📊 How It Works

### Zero-Downtime Backup Flow

1. Send `save-all` command via Pterodactyl API console
2. Wait 3-5 seconds for save to complete
3. Execute rsync backup with `--link-dest` (incremental)
4. Generate SHA-256 checksums
5. Queue offsite sync (if enabled)
6. Send Discord notification
7. Run retention cleanup

**Players stay connected during the entire process!**

### Restore Flow

1. User confirms restore (30s timeout)
2. Verify backup integrity (checksums)
3. Create pre-restore snapshot automatically
4. Stop server via Pterodactyl API
5. Execute rsync restore
6. Verify restored files
7. Start server
8. Monitor server startup (60s)
9. Send completion notification

## 📁 Directory Structure

```
/backups/minecraft-smp/
├── 2024-11-07_000000/          # Backup directories
├── 2024-11-07_120000/
├── latest -> 2024-11-07_120000 # Symlink to latest
├── pre-restore_*/              # Pre-restore snapshots (never auto-deleted)
└── checksums/                  # SHA-256 checksum files
```

## 🔒 Security

- API keys stored in config file with 600 permissions
- Role-based Discord permissions
- Separate roles for backup vs restore operations
- Complete audit trail of all operations
- Dedicated system user with minimal privileges

## 📈 Performance

- **Backup Time**: < 2 minutes for typical world (17GB)
- **Server Downtime**: 0 seconds (for regular backups)
- **Space Savings**: 95-98% with incremental backups
- **Memory Usage**: < 200MB idle, < 500MB during backup
- **CPU Usage**: < 10% during backup

## 🛠️ System Management

### Service Commands

```bash
# Start service
sudo systemctl start mc-backup

# Stop service
sudo systemctl stop mc-backup

# Restart service
sudo systemctl restart mc-backup

# Check status
sudo systemctl status mc-backup

# View logs
sudo journalctl -u mc-backup -f
```

### Audit Logs

```bash
# View recent logs
tail -f /var/log/mc-backup/audit-$(date +%Y-%m-%d).log

# Search logs
grep "BACKUP_COMPLETED" /var/log/mc-backup/audit-*.log
```

## 📚 Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [Discord Commands](docs/COMMANDS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [API Documentation](docs/API.md)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the Minecraft community
- Powered by rsync, rclone, and Discord.js
- Designed for Pterodactyl Panel

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/dronzer-tb/backupbot-v3/issues)
- **Documentation**: [Wiki](https://github.com/dronzer-tb/backupbot-v3/wiki)

## 🔄 Changelog

### v1.0.0 (2025-11-07)
- Initial release
- Zero-downtime backups
- Discord bot integration
- Automated scheduling
- Optional offsite backups
- Pre-restore snapshots
- Comprehensive audit logging

---

**Made with ❤️ for Minecraft server administrators**
