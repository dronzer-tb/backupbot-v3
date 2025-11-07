# 🚀 Quick Setup Guide

## Prerequisites

Before running the backup system, ensure you have:

1. **Node.js 18+** installed
2. **rsync** installed (`sudo apt install rsync`)
3. **Pterodactyl Panel** with API access
4. **Discord Bot** created with proper permissions
5. **Sufficient disk space** for backups

## Step 1: Configure the System

1. Copy the example configuration:
```bash
cp config/config.example.json config/config.json
```

2. Edit the configuration file:
```bash
nano config/config.json
```

3. Fill in the required values:

### Pterodactyl Configuration
```json
{
  "pterodactyl": {
    "panel_url": "https://your-panel.com",
    "api_key": "ptlc_your_api_key_here",
    "server_id": "your_server_id"
  }
}
```

**How to get these values:**
- `panel_url`: Your Pterodactyl panel URL
- `api_key`: Account Settings → API Credentials → Create API Key
- `server_id`: Server identifier from the URL or API

### Backup Configuration
```json
{
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/SERVER_UUID/world",
    "backup_dir": "/backups/minecraft-smp",
    "retention_local_days": 10,
    "cron_schedules": [
      "0 0 * * *",   // Daily at midnight
      "0 12 * * *",  // Daily at noon
      "0 18 * * *"   // Daily at 6 PM
    ]
  }
}
```

**Important:**
- Replace `SERVER_UUID` with your actual server UUID
- Ensure the backup directory exists and has proper permissions
- Adjust retention and schedules to your needs

### Discord Configuration
```json
{
  "discord": {
    "bot_token": "your_bot_token_here",
    "guild_id": "your_guild_id",
    "command_channel_id": "channel_id_for_commands",
    "notification_channel_id": "channel_id_for_notifications",
    "allowed_roles_backup": ["Admin", "Moderator"],
    "allowed_roles_restore": ["Admin"]
  }
}
```

**How to get these values:**
- `bot_token`: Discord Developer Portal → Your Application → Bot → Token
- `guild_id`: Right-click your server in Discord → Copy Server ID (enable Developer Mode)
- `channel_id`: Right-click the channel → Copy Channel ID
- Role names: Must match exactly as they appear in Discord

## Step 2: Create Backup Directory

```bash
sudo mkdir -p /backups/minecraft-smp
sudo chown -R $USER:$USER /backups/minecraft-smp
sudo chmod 755 /backups/minecraft-smp
```

## Step 3: Test Connections

### Test Pterodactyl Connection
```bash
npm run test:connection
```

Expected output:
```
✅ Connection successful!
Server Name: My Minecraft Server
Current State: running
```

### Test Discord Bot
```bash
npm run test:discord
```

Expected output:
```
✅ Connected as YourBot#1234
✅ Guild found: Your Server
✅ Channel found: #backups
```

## Step 4: Run Manual Backup (Optional)

Test the backup system:
```bash
npm run manual-backup
```

This will:
1. Connect to Pterodactyl
2. Send save-all command
3. Create a backup
4. Generate checksums
5. Clean up old backups

## Step 5: Start the Service

### Development Mode
```bash
npm start
```

### Production Mode (systemd)

1. Copy service file:
```bash
sudo cp systemd/mc-backup.service /etc/systemd/system/
```

2. Create system user:
```bash
sudo useradd -r -s /bin/false mc-backup
```

3. Copy application files:
```bash
sudo mkdir -p /opt/mc-backup
sudo cp -r . /opt/mc-backup/
sudo chown -R mc-backup:mc-backup /opt/mc-backup
```

4. Copy configuration:
```bash
sudo mkdir -p /etc/mc-backup
sudo cp config/config.json /etc/mc-backup/
sudo chown mc-backup:mc-backup /etc/mc-backup/config.json
sudo chmod 600 /etc/mc-backup/config.json
```

5. Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mc-backup
sudo systemctl start mc-backup
```

6. Check status:
```bash
sudo systemctl status mc-backup
sudo journalctl -u mc-backup -f
```

## Step 6: Test Discord Commands

In your Discord server, try these commands:

```
!backup help      # Show available commands
!backup status    # Check system status
!backup now       # Trigger a manual backup
!backup list      # List available backups
```

## Troubleshooting

### "Connection failed" Error
- Verify Pterodactyl panel URL is correct
- Check API key has proper permissions
- Ensure server ID is correct

### "Bot cannot send messages" Error
- Ensure bot has "Send Messages" permission
- Check bot role is high enough in role hierarchy
- Verify channel IDs are correct

### "Permission denied" Errors
- Check file/directory permissions
- Ensure user has access to backup directory
- Verify Pterodactyl volumes are readable

### View Logs
```bash
# Service logs
sudo journalctl -u mc-backup -f

# Audit logs
tail -f /var/log/mc-backup/audit-*.log
```

## Optional: Configure Offsite Backups

If you want cloud backups:

1. Install rclone:
```bash
curl https://rclone.org/install.sh | sudo bash
```

2. Configure rclone:
```bash
rclone config
```

3. Update config.json:
```json
{
  "rclone": {
    "enabled": true,
    "remote_name": "gdrive:minecraft-backups",
    "retention_offsite_days": 30,
    "sync_after_backup": true
  }
}
```

4. Restart service:
```bash
sudo systemctl restart mc-backup
```

## Next Steps

- Read the [full documentation](docs/)
- Set up monitoring and alerts
- Configure custom backup schedules
- Set up offsite backups
- Review security settings

---

**Need Help?** Check the [Troubleshooting Guide](docs/TROUBLESHOOTING.md) or open an issue on GitHub.
