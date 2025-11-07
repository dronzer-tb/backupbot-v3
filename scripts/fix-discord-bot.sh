#!/bin/bash
###############################################################################
# Quick Fix for Discord Bot Not Responding
# Run this on your VPS
###############################################################################

echo "🔧 Fixing Discord Bot..."
echo ""

# Step 1: Check if config has client_id
echo "1️⃣ Checking config..."
if ! sudo cat /etc/mc-backup/config.json | grep -q "client_id"; then
    echo "❌ ERROR: client_id missing from config!"
    echo ""
    echo "Please add client_id to /etc/mc-backup/config.json:"
    echo ""
    echo '  "discord": {'
    echo '    "bot_token": "your_token",'
    echo '    "client_id": "YOUR_APPLICATION_ID_HERE",  ← ADD THIS'
    echo '    ...'
    echo '  }'
    echo ""
    echo "Get your Application ID from:"
    echo "https://discord.com/developers/applications"
    echo ""
    exit 1
fi

CLIENT_ID=$(sudo cat /etc/mc-backup/config.json | grep -oP '"client_id":\s*"\K[^"]+')
echo "✅ Found client_id: $CLIENT_ID"
echo ""

# Step 2: Stop service
echo "2️⃣ Stopping service..."
sudo systemctl stop mc-backup
echo "✅ Stopped"
echo ""

# Step 3: Pull latest code
echo "3️⃣ Pulling latest code..."
cd /opt/mc-backup
sudo git pull origin master
echo "✅ Updated"
echo ""

# Step 4: Install dependencies
echo "4️⃣ Installing dependencies..."
sudo npm install --production --silent
echo "✅ Installed"
echo ""

# Step 5: Deploy slash commands
echo "5️⃣ Deploying slash commands..."
sudo -u mc-backup node /opt/mc-backup/src/discord/deploy-commands.js
if [ $? -eq 0 ]; then
    echo "✅ Commands deployed"
else
    echo "❌ Failed to deploy commands"
    echo "Check error above"
    exit 1
fi
echo ""

# Step 6: Restart service
echo "6️⃣ Restarting service..."
sudo systemctl restart mc-backup
sleep 3

if sudo systemctl is-active --quiet mc-backup; then
    echo "✅ Service running"
else
    echo "❌ Service failed to start"
    echo ""
    echo "Check logs:"
    echo "sudo journalctl -u mc-backup -n 50 --no-pager"
    exit 1
fi
echo ""

# Step 7: Done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Fix complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⏰ Wait 2-3 minutes for Discord to update"
echo "🔄 Refresh Discord (Ctrl+R or restart app)"
echo "✨ Try typing '/' in Discord to see commands"
echo ""
echo "Test with: /status"
echo ""
