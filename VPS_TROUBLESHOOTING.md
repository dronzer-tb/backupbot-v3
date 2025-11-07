# 🔧 Discord Bot Not Responding - Troubleshooting Guide

## Symptoms
- ✅ Bot shows as "Online" in Discord
- ❌ Bot doesn't respond to slash commands (`/backup`, `/status`, etc.)
- ❌ Bot doesn't respond to text commands (`!backup`)

---

## Quick Fix Steps (Run on Your VPS)

### Step 1: Check if Bot is Running

```bash
sudo systemctl status mc-backup
```

**Expected:** Should show "active (running)" in green

If not running:
```bash
sudo systemctl start mc-backup
sudo journalctl -u mc-backup -n 50 --no-pager
```

---

### Step 2: Check Config Has client_id

```bash
sudo cat /etc/mc-backup/config.json | grep client_id
```

**Expected:** Should show `"client_id": "YOUR_CLIENT_ID_HERE"`

If missing, add it:
```bash
sudo nano /etc/mc-backup/config.json
```

Add this line in the discord section:
```json
"client_id": "YOUR_APPLICATION_ID_FROM_DISCORD_PORTAL",
```

**Get Client ID:**
1. Go to https://discord.com/developers/applications
2. Click your bot application
3. Copy the "Application ID" (NOT the bot token!)
4. Paste it in config.json

---

### Step 3: Check Bot Logs for Errors

```bash
sudo journalctl -u mc-backup -n 100 --no-pager | grep -i error
```

Common errors:
- **"Unknown interaction"** = Slash commands not deployed
- **"Missing Access"** = Bot doesn't have permissions in Discord server
- **"Invalid token"** = Wrong bot token in config
- **"client_id is required"** = Missing client_id in config

---

### Step 4: Manually Deploy Slash Commands

This is the most common fix:

```bash
sudo -u mc-backup node /opt/mc-backup/src/discord/deploy-commands.js
```

**Expected output:**
```
Deploying slash commands to Discord...
✓ Successfully deployed slash commands!
✓ Registered 9 commands
```

**If you get an error:**
- Check client_id is in config.json
- Check bot_token is correct
- Check bot has "applications.commands" scope

---

### Step 5: Restart the Service

```bash
sudo systemctl restart mc-backup
sleep 5
sudo systemctl status mc-backup
```

---

### Step 6: Test in Discord

**Wait 2-3 minutes** after deploying commands (Discord caches)

Then:
1. **Refresh Discord** (Ctrl+R or close and reopen)
2. Type `/` in any channel
3. Look for your bot's commands
4. Try `/status` (simplest command)

---

## Detailed Diagnostics

### Check All Bot Components

```bash
# 1. Check service status
sudo systemctl status mc-backup

# 2. Check if bot is connected to Discord
sudo journalctl -u mc-backup -n 200 --no-pager | grep "Discord bot logged in"

# 3. Check for interaction errors
sudo journalctl -u mc-backup -n 200 --no-pager | grep "interaction"

# 4. Check config is valid JSON
sudo cat /etc/mc-backup/config.json | jq '.'

# 5. Check bot has correct permissions
sudo ls -l /opt/mc-backup/src/discord/bot.js
```

---

## Common Issues & Solutions

### Issue 1: "Unknown interaction" Error

**Cause:** Slash commands not deployed or bot restarted before Discord updated

**Fix:**
```bash
sudo -u mc-backup node /opt/mc-backup/src/discord/deploy-commands.js
sudo systemctl restart mc-backup
# Wait 2-3 minutes, then refresh Discord
```

---

### Issue 2: Bot Online But Commands Don't Appear

**Cause:** Missing `client_id` or wrong permissions

**Fix:**
```bash
# Add client_id to config
sudo nano /etc/mc-backup/config.json

# Verify bot has "applications.commands" scope
# Go to Discord Developer Portal → Your App → OAuth2 → URL Generator
# Select: bot, applications.commands
# Use that URL to re-invite bot
```

---

### Issue 3: Old Commands Still Showing

**Cause:** Discord cache

**Fix:**
1. Clear Discord cache: Settings → Advanced → Clear Cache
2. Or completely close and reopen Discord
3. Or wait 5-10 minutes

---

### Issue 4: "Missing Access" Error

**Cause:** Bot doesn't have permission in the channel

**Fix:**
1. Go to Discord Server Settings → Integrations
2. Find your bot
3. Make sure bot can access the channel
4. Give bot "Send Messages", "Embed Links", "Use Slash Commands" permissions

---

### Issue 5: Text Commands (!backup) Don't Work

**Cause:** Bot requires slash commands now (text commands are legacy)

**Fix:**
Use slash commands instead: `/backup` instead of `!backup`

Or if you must use text commands, check:
```bash
# Check if MESSAGE_CONTENT intent is enabled
# Go to Discord Developer Portal → Your App → Bot → Privileged Gateway Intents
# Enable "Message Content Intent"
```

---

## Manual Test Script

Run this to test if the bot can connect:

```bash
sudo -u mc-backup node /opt/mc-backup/scripts/test-discord.js
```

**Expected output:**
```
✅ Discord bot connected successfully
✅ Bot can send messages
```

---

## Check Bot Permissions in Discord

Your bot needs these permissions:

**Required Scopes:**
- `bot`
- `applications.commands`

**Required Permissions:**
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands
- View Channels

**Invite URL Format:**
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274878221376&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your actual client ID.

---

## If Nothing Works - Complete Reset

```bash
# 1. Stop service
sudo systemctl stop mc-backup

# 2. Remove old slash commands
sudo -u mc-backup node -e "
const { REST, Routes } = require('discord.js');
const config = require('/etc/mc-backup/config.json');
const rest = new REST({ version: '10' }).setToken(config.discord.bot_token);
rest.put(Routes.applicationCommands(config.discord.client_id), { body: [] })
  .then(() => console.log('✓ Cleared all commands'))
  .catch(console.error);
"

# 3. Wait 30 seconds
sleep 30

# 4. Deploy fresh commands
sudo -u mc-backup node /opt/mc-backup/src/discord/deploy-commands.js

# 5. Restart service
sudo systemctl restart mc-backup

# 6. Wait 2 minutes
sleep 120

# 7. Refresh Discord and test
```

---

## Still Not Working?

### Get Full Logs

```bash
# Last 500 lines
sudo journalctl -u mc-backup -n 500 --no-pager > /tmp/bot-logs.txt
cat /tmp/bot-logs.txt
```

### Check These Specific Things:

1. **Is client_id in config?**
   ```bash
   sudo cat /etc/mc-backup/config.json | jq '.discord.client_id'
   ```

2. **Is bot token valid?**
   ```bash
   sudo cat /etc/mc-backup/config.json | jq '.discord.bot_token' | wc -c
   # Should be around 70 characters
   ```

3. **Can bot connect to Discord API?**
   ```bash
   curl -H "Authorization: Bot YOUR_BOT_TOKEN" https://discord.com/api/v10/users/@me
   # Should return bot info, not 401 Unauthorized
   ```

4. **Are commands registered globally?**
   ```bash
   curl -H "Authorization: Bot YOUR_BOT_TOKEN" \
        https://discord.com/api/v10/applications/YOUR_CLIENT_ID/commands
   # Should return array of 9 commands
   ```

---

## Emergency: Use Text Commands Instead

If slash commands absolutely won't work, you can use the old text commands:

1. Make sure bot has "Message Content Intent" enabled in Discord Portal
2. Restart bot: `sudo systemctl restart mc-backup`
3. Use commands like:
   ```
   !backup now
   !backup status
   !backup list
   ```

---

## Contact Support

If you've tried everything and it still doesn't work, provide these details:

1. Output of: `sudo systemctl status mc-backup`
2. Output of: `sudo journalctl -u mc-backup -n 200 --no-pager`
3. Output of: `sudo cat /etc/mc-backup/config.json | jq '.discord'` (hide bot_token!)
4. Screenshot of Discord Developer Portal → Your App → Bot settings
5. Screenshot of typing `/` in Discord (shows if commands appear)

---

## Quick Reference Commands

```bash
# Check status
sudo systemctl status mc-backup

# View logs
sudo journalctl -u mc-backup -n 100 --no-pager

# Deploy commands
sudo -u mc-backup node /opt/mc-backup/src/discord/deploy-commands.js

# Restart
sudo systemctl restart mc-backup

# Test Discord
sudo -u mc-backup node /opt/mc-backup/scripts/test-discord.js

# Check config
sudo cat /etc/mc-backup/config.json | jq '.discord'
```

---

**Most Common Solution: Deploy slash commands + restart service + wait 2 minutes + refresh Discord** ✨
