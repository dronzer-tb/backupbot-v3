# Multi-Server Support Guide

This guide explains how to run multiple instances of the backup bot on a single VPS to back up multiple Minecraft servers.

## 🏗️ Architecture

Each Minecraft server gets its own isolated backup bot instance with:
- **Separate configuration file** (`/etc/mc-backup-{name}/config.json`)
- **Separate backup directory** (`/backups/minecraft-{name}`)
- **Separate systemd service** (`mc-backup-{name}.service`)
- **Separate log file** (`/var/log/mc-backup/mc-backup-{name}.log`)
- **Shared bot application** (optional: can share `/opt/mc-backup` or install separate instances)

## 🚀 Setup Methods

### Method 1: Shared Installation (Recommended)

Use one bot installation for all servers, but separate configs and services.

#### Step 1: Install the bot once
```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | bash
```

#### Step 2: Create additional instances
```bash
# For each additional server, run:
sudo /opt/mc-backup/scripts/create-instance.sh smp2

# This creates:
# - /etc/mc-backup-smp2/config.json
# - /backups/minecraft-smp2/
# - /var/log/mc-backup/mc-backup-smp2.log
# - /etc/systemd/system/mc-backup-smp2.service
```

#### Step 3: Configure each instance
```bash
sudo nano /etc/mc-backup-smp2/config.json
# Update server_id, world path, Discord channels, etc.
```

#### Step 4: Start the service
```bash
sudo systemctl start mc-backup-smp2
sudo systemctl enable mc-backup-smp2
```

---

### Method 2: Separate Installations

Install completely separate bot instances (use when you need different bot versions).

#### Install each instance to a different directory:
```bash
# Server 1 (SMP)
git clone https://github.com/dronzer-tb/backupbot-v3.git /opt/mc-backup-smp
cd /opt/mc-backup-smp
./install.sh

# Server 2 (Creative)
git clone https://github.com/dronzer-tb/backupbot-v3.git /opt/mc-backup-creative
cd /opt/mc-backup-creative
./install.sh
```

Each gets independent configs, services, and backup directories.

---

## 📋 Instance Naming Convention

Use descriptive names for your servers:

| Server Type | Instance Name | Config Path | Service Name |
|------------|---------------|-------------|--------------|
| Main SMP | `smp` | `/etc/mc-backup-smp/` | `mc-backup-smp` |
| Creative | `creative` | `/etc/mc-backup-creative/` | `mc-backup-creative` |
| Modded | `modded` | `/etc/mc-backup-modded/` | `mc-backup-modded` |
| Testing | `test` | `/etc/mc-backup-test/` | `mc-backup-test` |

---

## 🔧 Configuration Differences

Each instance needs unique values:

### 1. **Pterodactyl Server ID**
```json
{
  "pterodactyl": {
    "server_id": "abc123def",  // Different for each server
    "panel_url": "https://panel.dronzersmp.fun",  // Same for all
    "api_key": "ptlc_..."  // Can be same or different
  }
}
```

### 2. **World Path**
```json
{
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/{server-uuid}/world"  // Different UUID
  }
}
```

### 3. **Backup Directory**
```json
{
  "backup": {
    "backup_dir": "/backups/minecraft-smp2"  // Unique per server
  }
}
```

### 4. **Discord Channels** (Optional)
```json
{
  "discord": {
    "channels": {
      "backup_log": "1234567890123456789",  // Different per server
      "status": "9876543210987654321"
    }
  }
}
```

### 5. **Backup Schedule**
```json
{
  "backup": {
    "schedule": {
      "full_backup": "0 */6 * * *",  // Stagger schedules!
      "incremental": "0 */2 * * *"
    }
  }
}
```

**⚠️ IMPORTANT:** Stagger backup schedules to avoid resource contention:
- SMP: Every 6 hours starting at 00:00 (`0 */6 * * *`)
- Creative: Every 6 hours starting at 01:00 (`0 1,7,13,19 * * *`)
- Modded: Every 6 hours starting at 02:00 (`0 2,8,14,20 * * *`)

---

## 🎮 Managing Multiple Instances

### Check all services
```bash
sudo systemctl status mc-backup-*
```

### View logs for specific server
```bash
sudo journalctl -u mc-backup-smp2 -f
```

### Restart specific instance
```bash
sudo systemctl restart mc-backup-creative
```

### Trigger manual backup for specific server
```bash
sudo -u mc-backup node /opt/mc-backup/scripts/manual-backup.js \
  --config /etc/mc-backup-smp2/config.json
```

---

## 📊 Resource Considerations

### Disk Space
Each server needs its own backup directory. Plan disk usage:
```
SMP:       50GB backups × 7 days = 350GB
Creative:  20GB backups × 7 days = 140GB
Modded:    80GB backups × 7 days = 560GB
Total:                             1050GB (1TB)
```

### Memory
Each bot instance uses ~50-100MB RAM. For 3 servers:
- Bot processes: ~300MB
- rsync during backup: +500MB-1GB per active backup
- **Recommendation:** 2GB+ RAM for VPS with 3 servers

### CPU
Minimal impact during idle. During backups:
- rsync: Medium CPU usage
- Checksum generation: Medium CPU usage
- **Recommendation:** Stagger schedules to avoid simultaneous backups

---

## 🔐 Discord Bot Sharing

### Option 1: One bot for all servers (Recommended)
Use the same Discord bot token in all configs. The bot will:
- Send backup logs to different channels per server
- Respond to `/backup` commands for all servers
- Show status for all configured servers in one bot

### Option 2: Separate Discord bots per server
- Create multiple bot applications on Discord Developer Portal
- Each config uses a different bot token
- Each bot only manages one server

**Recommended:** Use Option 1 (shared bot) for easier management.

---

## 🛠️ Example: Adding a Second Server

Let's add a creative server to an existing SMP setup:

### 1. Create instance structure
```bash
sudo mkdir -p /etc/mc-backup-creative
sudo mkdir -p /backups/minecraft-creative
sudo chown mc-backup:mc-backup /backups/minecraft-creative
```

### 2. Copy and modify config
```bash
sudo cp /etc/mc-backup/config.json /etc/mc-backup-creative/config.json
sudo nano /etc/mc-backup-creative/config.json
```

Update:
- `server_id` → Creative server ID
- `source_path` → Creative world path
- `backup_dir` → `/backups/minecraft-creative`
- `channels.backup_log` → Creative backup channel
- `schedule.full_backup` → `0 1,7,13,19 * * *` (offset by 1 hour)

### 3. Create systemd service
```bash
sudo cp /etc/systemd/system/mc-backup.service \
        /etc/systemd/system/mc-backup-creative.service
sudo nano /etc/systemd/system/mc-backup-creative.service
```

Update:
- `Description=Minecraft SMP Backup System` → `...Creative...`
- Add environment variable:
  ```ini
  Environment="CONFIG_PATH=/etc/mc-backup-creative/config.json"
  ```

### 4. Update bot to support CONFIG_PATH
In `/opt/mc-backup/src/index.js`:
```javascript
const configPath = process.env.CONFIG_PATH || '/etc/mc-backup/config.json';
const ConfigManager = require('./config/ConfigManager');
ConfigManager.initialize(configPath);
```

### 5. Start the service
```bash
sudo systemctl daemon-reload
sudo systemctl start mc-backup-creative
sudo systemctl enable mc-backup-creative
sudo systemctl status mc-backup-creative
```

### 6. Test
```bash
# In Discord, run:
/backup trigger server:creative

# Check logs:
sudo journalctl -u mc-backup-creative -f
```

---

## 🐛 Troubleshooting

### Issue: Services conflict
**Problem:** Two instances trying to use same config

**Solution:** Verify each service uses unique `CONFIG_PATH`:
```bash
sudo systemctl cat mc-backup-smp | grep CONFIG_PATH
sudo systemctl cat mc-backup-creative | grep CONFIG_PATH
```

### Issue: Backup schedules overlap
**Problem:** All servers backing up at same time = resource spike

**Solution:** Stagger cron expressions by 1-2 hours:
```
SMP:      0 0,6,12,18 * * *    (00:00, 06:00, 12:00, 18:00)
Creative: 0 1,7,13,19 * * *    (01:00, 07:00, 13:00, 19:00)
Modded:   0 2,8,14,20 * * *    (02:00, 08:00, 14:00, 20:00)
```

### Issue: Discord bot shows wrong server
**Problem:** Bot commands affect wrong server

**Solution:** Ensure each config has unique `server_id` and channel IDs

---

## 📝 Quick Reference

### File Structure for 3 Servers
```
/opt/mc-backup/                    # Shared bot application
├── src/
├── node_modules/
└── scripts/

/etc/mc-backup/                    # SMP config
├── config.json
└── .env

/etc/mc-backup-creative/           # Creative config
├── config.json
└── .env

/etc/mc-backup-modded/             # Modded config
├── config.json
└── .env

/backups/
├── minecraft-smp/                 # SMP backups
├── minecraft-creative/            # Creative backups
└── minecraft-modded/              # Modded backups

/etc/systemd/system/
├── mc-backup.service              # SMP service
├── mc-backup-creative.service     # Creative service
└── mc-backup-modded.service       # Modded service
```

---

## 🎯 Best Practices

1. **Use descriptive instance names** (`smp`, `creative`, not `server1`, `server2`)
2. **Stagger backup schedules** to avoid resource contention
3. **Use separate Discord channels** for each server's logs
4. **Monitor disk usage** regularly with `df -h /backups`
5. **Set different retention policies** based on server importance
6. **Test manual backups** before relying on automated schedules
7. **Document your setup** in a local README

---

## 🚨 Need Help?

- **GitHub Issues:** https://github.com/dronzer-tb/backupbot-v3/issues
- **Check logs:** `sudo journalctl -u mc-backup-{name} -f`
- **Verify config:** `sudo cat /etc/mc-backup-{name}/config.json | jq`
- **Test connectivity:** `sudo -u mc-backup node /opt/mc-backup/scripts/test-connection.js`
