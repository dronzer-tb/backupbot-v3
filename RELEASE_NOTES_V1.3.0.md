# 🎉 BackupBot v1.3.0 - Major Update!

## What's New in v1.3.0

### 🎮 Discord Slash Commands + Interactive Buttons

**No more typing commands!** The bot now uses modern Discord slash commands with clickable buttons.

#### How to Use:

1. **Type `/` in Discord** - You'll see all available commands:
   - `/backup` - Create a backup (with confirmation button!)
   - `/status` - Check system status
   - `/list` - View available backups
   - `/restore` - Restore from a backup
   - `/logs` - View recent logs
   - `/info` - Get backup details
   - `/config` - View configuration
   - `/update` - Check for/install updates

2. **Click buttons instead of typing** - When you run `/backup`, you'll get a confirmation button:
   ```
   🔄 Confirm Backup
   Click Confirm to start a manual backup.

   [✓ Confirm]  [✗ Cancel]
   ```

3. **Old commands still work** - `!backup` commands are supported for backward compatibility

---

### 🔄 Auto-Update System

**The bot can now update itself automatically!**

#### Features:
- ✅ Daily update checks at 12:00 PM
- ✅ Discord notifications when updates are available
- ✅ One-click install via `/update` command
- ✅ Automatic rollback if update fails
- ✅ No downtime during updates

#### How it Works:

1. **Automatic Daily Check**
   - Every day at 12 PM, the bot checks GitHub for updates
   - If an update is found, you get a Discord notification:
     ```
     🔔 BackupBot Update Available!
     Current Version: v1.2.3
     Available Version: v1.3.0
     
     Use /update action:install to update
     ```

2. **Manual Update via Discord**
   ```
   /update action:check      - Check if updates are available
   /update action:install    - Install the update
   /update action:changelog  - View what's new
   ```

3. **Update Process**
   - Stops the service
   - Backs up current installation
   - Pulls latest code from GitHub
   - Installs dependencies
   - Restarts service
   - Rolls back if anything fails

#### Safety Features:
- 🛡️ Automatic backup before updating
- 🛡️ Automatic rollback on failure
- 🛡️ Configuration files are preserved
- 🛡️ No data loss

---

### 🗑️ Improved Uninstall Script

**Now properly removes loop containers!**

#### What's Fixed:
- ✅ Detects and unmounts loop devices
- ✅ Removes container files
- ✅ Cleans up fstab entries
- ✅ Asks for confirmation before deleting backups

#### How to Use:
```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/uninstall.sh | sudo bash
```

You'll be asked:
1. Complete removal or keep config?
2. Remove storage container? (All backups will be deleted!)
3. Remove configuration files?
4. Remove logs?

---

## 🚀 Updating to v1.3.0

### New Installation (Recommended)

```bash
# Uninstall old version
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/uninstall.sh | sudo bash

# Install v1.3.0
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | sudo bash
```

During installation, you'll need to provide:
- **Discord Client ID** (NEW!) - Find it in Discord Developer Portal → Your App → Application ID

### Manual Update (Keep Configuration)

```bash
# Stop service
sudo systemctl stop mc-backup

# Pull latest code
cd /opt/mc-backup
sudo git pull origin master

# Install dependencies
sudo npm install --production

# Update scripts
sudo chmod +x scripts/*.sh scripts/*.js

# Update sudoers
sudo tee -a /etc/sudoers.d/mc-backup-permissions << 'EOF'

# Allow mc-backup user to run auto-update script without password
mc-backup ALL=(ALL) NOPASSWD: /opt/mc-backup/scripts/auto-update.sh
EOF

# Deploy slash commands (IMPORTANT!)
sudo -u mc-backup node src/discord/deploy-commands.js

# Restart service
sudo systemctl restart mc-backup

# Check status
sudo systemctl status mc-backup
```

---

## 📋 Required Configuration Changes

### 1. Add Discord Client ID

Edit `/etc/mc-backup/config.json`:

```json
{
  "discord": {
    "bot_token": "your_token_here",
    "client_id": "YOUR_CLIENT_ID_HERE",  ← ADD THIS
    "guild_id": "your_guild_id",
    ...
  }
}
```

**How to get Client ID:**
1. Go to https://discord.com/developers/applications
2. Select your bot
3. Copy the "Application ID"
4. Paste it in `client_id` field

### 2. Deploy Slash Commands

After updating, you MUST deploy slash commands:

```bash
sudo -u mc-backup node /opt/mc-backup/src/discord/deploy-commands.js
```

**Expected output:**
```
Deploying slash commands to Discord...
✓ Successfully deployed slash commands!
✓ Registered 9 commands
```

---

## 🧪 Testing the Update

### Test Slash Commands
1. Go to your Discord server
2. Type `/` in any channel
3. You should see all BackupBot commands

### Test Backup with Buttons
1. Run `/backup`
2. Click the **✓ Confirm** button
3. Watch the backup progress

### Test Auto-Update
1. Run `/update action:check`
2. It should tell you your current version

### Test Update Notification
```bash
# Manually trigger update check
sudo -u mc-backup /opt/mc-backup/scripts/auto-update.sh check
```

---

## 🐛 Troubleshooting

### Slash Commands Not Showing

**Problem:** When I type `/`, I don't see any BackupBot commands

**Solutions:**
1. Make sure you added `client_id` to config.json
2. Deploy commands manually:
   ```bash
   sudo -u mc-backup node /opt/mc-backup/src/discord/deploy-commands.js
   ```
3. Restart Discord (close completely and reopen)
4. Wait 5 minutes (Discord caches commands)

### Bot Not Responding to `/backup`

**Problem:** Bot doesn't respond when I click buttons

**Solutions:**
1. Check bot has correct permissions in Discord
2. Verify service is running:
   ```bash
   sudo systemctl status mc-backup
   ```
3. Check logs:
   ```bash
   sudo journalctl -u mc-backup -n 100 --no-pager
   ```

### Auto-Update Permission Denied

**Problem:** `/update` says "Permission denied"

**Solutions:**
1. Check sudoers file:
   ```bash
   sudo cat /etc/sudoers.d/mc-backup-permissions
   ```
   Should contain:
   ```
   mc-backup ALL=(ALL) NOPASSWD: /opt/mc-backup/scripts/auto-update.sh
   ```

2. Make script executable:
   ```bash
   sudo chmod +x /opt/mc-backup/scripts/auto-update.sh
   ```

### Loop Container Not Removed

**Problem:** `lsblk` still shows old loop devices after uninstall

**Manual removal:**
```bash
# Find loop device
lsblk | grep /backups

# Unmount
sudo umount /backups/minecraft-smp

# Detach loop
sudo losetup -d /dev/loop5  # Replace with your loop number

# Remove container file
sudo rm /opt/mc-backup-container.img  # Find actual path first

# Remove mount point
sudo rm -rf /backups/minecraft-smp
```

---

## 📊 Version Comparison

| Feature | v1.2.3 | v1.3.0 |
|---------|--------|--------|
| **Discord Commands** | Text (`!backup`) | Slash commands (`/backup`) |
| **User Interface** | Type commands | Click buttons |
| **Auto Updates** | ❌ Manual only | ✅ Automatic checks + Discord install |
| **Update Notifications** | ❌ None | ✅ Daily at 12 PM |
| **Uninstall Cleanup** | ⚠️ Leaves loop devices | ✅ Complete removal |
| **Permission Fix** | ✅ Automatic | ✅ Automatic (unchanged) |
| **Multi-world Support** | ✅ Paper/Spigot | ✅ Paper/Spigot (unchanged) |

---

## 🎯 What's Next?

Future updates will be automatically detected and you'll get notified in Discord!

To install future updates, simply run:
```
/update action:install
```

That's it! No more manual installation steps.

---

## 📞 Support

**If you encounter any issues:**

1. Check troubleshooting section above
2. View logs: `sudo journalctl -u mc-backup -n 100`
3. Test Discord bot: `sudo -u mc-backup node /opt/mc-backup/scripts/test-discord.js`
4. Open a GitHub issue with logs

---

## 🎉 Enjoy v1.3.0!

Your backup system is now more modern, more automated, and easier to use than ever!

**Key Benefits:**
- 🎮 Intuitive Discord interface with buttons
- 🔄 Automated updates - stay current effortlessly
- 🗑️ Clean uninstalls - no leftover loop devices
- 🚀 Production-ready with zero manual maintenance

---

*Developed by: Neelansh Kasniya (Dronzer Studios)*  
*Release Date: November 8, 2025*  
*Version: v1.3.0*
