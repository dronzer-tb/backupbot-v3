# 🚀 Quick Setup Guide - BackupBot v3 (v1.1.0)

## For Docker/Pterodactyl Users (Bug Fix Applied!)

### 1. Install the Bot

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | sudo bash
```

### 2. Configure for Container Environment

Edit `/etc/mc-backup/config.json`:

```json
{
  "pterodactyl": {
    "panel_url": "https://your-panel.com",
    "api_key": "ptlc_YOUR_API_KEY",
    "server_id": "YOUR_SERVER_ID"
  },
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/YOUR_UUID/world",
    "container_path": "/home/container/world",
    "use_container_path": true,    // ← SET TO TRUE for Docker!
    "backup_dir": "/backups/minecraft-smp",
    "max_backup_size_gb": 50,      // ← How much storage to dedicate
    "retention_local_days": 10,
    "cron_schedules": ["0 */6 * * *"]
  },
  "discord": {
    "bot_token": "YOUR_BOT_TOKEN",
    "guild_id": "YOUR_GUILD_ID",
    "notification_channel_id": "CHANNEL_ID",
    "allowed_roles_backup": ["Admin", "Moderator"],
    "allowed_roles_restore": ["Admin"]
  },
  "alerts": {
    "disk_usage_warning": 80,
    "disk_usage_critical": 95,
    "use_allocated_storage": true   // ← Use quota-based alerts
  }
}
```

### 3. Key Settings Explained

| Setting | What It Does |
|---------|--------------|
| `use_container_path: true` | Use `/home/container/world` instead of `/var/lib/pterodactyl/...` |
| `max_backup_size_gb: 50` | Dedicate 50 GB for backups (quota system) |
| `use_allocated_storage: true` | Alert when backups exceed quota, not full disk |

### 4. Start the Service

```bash
sudo systemctl start mc-backup
sudo systemctl status mc-backup
```

## For Host-Based Users (Traditional Setup)

### Configuration
```json
{
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/YOUR_UUID/world",
    "use_container_path": false,   // ← Keep FALSE
    "backup_dir": "/backups/minecraft-smp",
    "max_backup_size_gb": 100,     // ← Optional: Set quota
    "retention_local_days": 10
  },
  "alerts": {
    "use_allocated_storage": true  // ← Optional: Use quota
  }
}
```

## Storage Quota Examples

### Example 1: 50 GB Dedicated Storage
```json
"backup": {
  "max_backup_size_gb": 50
},
"alerts": {
  "disk_usage_warning": 80,      // Alert at 40 GB
  "disk_usage_critical": 95,     // Critical at 47.5 GB
  "use_allocated_storage": true
}
```

### Example 2: 200 GB Dedicated Storage
```json
"backup": {
  "max_backup_size_gb": 200
},
"alerts": {
  "disk_usage_warning": 75,      // Alert at 150 GB
  "disk_usage_critical": 90,     // Critical at 180 GB
  "use_allocated_storage": true
}
```

### Example 3: Use Full Disk (Original Behavior)
```json
"backup": {
  // No max_backup_size_gb needed
},
"alerts": {
  "disk_usage_warning": 80,
  "disk_usage_critical": 95,
  "use_allocated_storage": false  // Monitor entire disk
}
```

## Testing Your Setup

### 1. Test Pterodactyl Connection
```bash
npm run test:connection
```

### 2. Test Discord Bot
```bash
npm run test:discord
```

### 3. Run Manual Backup
```bash
npm run manual-backup
```

Or via Discord:
```
!backup now
```

## Troubleshooting

### Issue: "Permission denied (13)" Error

**Old Problem:**
```
rsync: change_dir "/var/lib/pterodactyl/..." failed: Permission denied
```

**Solution:**
Set `use_container_path: true` in your config!

### Issue: Backups Filling Entire Disk

**Solution:**
```json
"backup": {
  "max_backup_size_gb": 50  // Set your limit
},
"alerts": {
  "use_allocated_storage": true
}
```

### Issue: Don't Know Server UUID

Find it in Pterodactyl:
```bash
# Option 1: Check Pterodactyl panel URL
https://panel.com/server/88aa51dc-ee43-40c0-b949-bdca78811a67

# Option 2: Check on server
ls /var/lib/pterodactyl/volumes/
```

## What's New in v1.1.0

✅ **Fixed:** Docker/Pterodactyl container backup failures  
✅ **Added:** Container path auto-detection  
✅ **Added:** Dedicated storage allocation  
✅ **Added:** Quota-based disk alerts  
✅ **Improved:** Better error messages  
✅ **Tested:** All 11 tests passing  

## Need Help?

- 📖 Full documentation: `BUGFIX_DOCKER_PATH.md`
- 🐛 Report issues: https://github.com/dronzer-tb/backupbot-v3/issues
- 💬 Discord: Use `!backup help` command

---

**Version:** 1.1.0  
**Updated:** November 7, 2025  
**Status:** ✅ Production Ready
