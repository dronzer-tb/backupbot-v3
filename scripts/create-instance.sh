#!/bin/bash

###############################################################################
# Multi-Server Instance Creator
# Creates a new backup bot instance for an additional Minecraft server
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo $0 $@"
    exit 1
fi

# Check if instance name provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Instance name required${NC}"
    echo ""
    echo "Usage: sudo $0 <instance-name>"
    echo ""
    echo "Examples:"
    echo "  sudo $0 smp2        # Creates mc-backup-smp2"
    echo "  sudo $0 creative    # Creates mc-backup-creative"
    echo "  sudo $0 modded      # Creates mc-backup-modded"
    echo ""
    exit 1
fi

INSTANCE_NAME="$1"
SERVICE_NAME="mc-backup-${INSTANCE_NAME}"
CONFIG_DIR="/etc/mc-backup-${INSTANCE_NAME}"
BACKUP_DIR="/backups/minecraft-${INSTANCE_NAME}"
LOG_FILE="/var/log/mc-backup/mc-backup-${INSTANCE_NAME}.log"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    Multi-Server Instance Creator                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Creating new instance: ${GREEN}${INSTANCE_NAME}${NC}"
echo ""

# Check if instance already exists
if [ -d "$CONFIG_DIR" ]; then
    echo -e "${RED}Error: Instance '${INSTANCE_NAME}' already exists${NC}"
    echo -e "Config directory: $CONFIG_DIR"
    echo ""
    echo "To modify this instance, edit:"
    echo "  sudo nano $CONFIG_DIR/config.json"
    echo ""
    echo "To remove this instance, run:"
    echo "  sudo systemctl stop ${SERVICE_NAME}"
    echo "  sudo systemctl disable ${SERVICE_NAME}"
    echo "  sudo rm -rf $CONFIG_DIR"
    echo "  sudo rm -f /etc/systemd/system/${SERVICE_NAME}.service"
    echo "  sudo systemctl daemon-reload"
    exit 1
fi

# Step 1: Create directories
echo -e "${BLUE}[1/5]${NC} Creating directories..."
mkdir -p "$CONFIG_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p /var/log/mc-backup

chown mc-backup:mc-backup "$CONFIG_DIR"
chown mc-backup:mc-backup "$BACKUP_DIR"
chown mc-backup:mc-backup /var/log/mc-backup

chmod 750 "$CONFIG_DIR"
chmod 755 "$BACKUP_DIR"

echo -e "  ${GREEN}✓${NC} Created $CONFIG_DIR"
echo -e "  ${GREEN}✓${NC} Created $BACKUP_DIR"
echo ""

# Step 2: Copy base config
echo -e "${BLUE}[2/5]${NC} Creating configuration..."
if [ -f "/etc/mc-backup/config.json" ]; then
    cp /etc/mc-backup/config.json "$CONFIG_DIR/config.json"
    echo -e "  ${GREEN}✓${NC} Copied base config from /etc/mc-backup"
else
    echo -e "  ${YELLOW}⚠${NC} Base config not found, creating template..."
    cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "pterodactyl": {
    "panel_url": "https://panel.dronzersmp.fun",
    "api_key": "YOUR_API_KEY_HERE",
    "server_id": "YOUR_SERVER_ID_HERE"
  },
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/{server-uuid}/world",
    "backup_dir": "/backups/minecraft-INSTANCE_NAME",
    "schedule": {
      "full_backup": "0 */6 * * *",
      "incremental": "0 */2 * * *"
    },
    "retention": {
      "daily": 7,
      "weekly": 4,
      "monthly": 3
    }
  },
  "discord": {
    "bot_token": "YOUR_BOT_TOKEN_HERE",
    "client_id": "YOUR_CLIENT_ID_HERE",
    "channels": {
      "backup_log": "CHANNEL_ID_HERE",
      "status": "CHANNEL_ID_HERE",
      "alerts": "CHANNEL_ID_HERE"
    },
    "roles": {
      "allowed_roles_backup": ["Admin"],
      "allowed_roles_restore": ["Admin"],
      "notification_role": "Admin"
    }
  },
  "storage": {
    "max_disk_usage_percent": 85,
    "min_free_space_gb": 20
  },
  "offsite": {
    "enabled": false,
    "provider": "rclone",
    "remote_name": "b2",
    "remote_path": "minecraft-backups",
    "schedule": "0 3 * * *",
    "retention_days": 30
  }
}
EOF
    sed -i "s/minecraft-INSTANCE_NAME/minecraft-${INSTANCE_NAME}/g" "$CONFIG_DIR/config.json"
fi

chown mc-backup:mc-backup "$CONFIG_DIR/config.json"
chmod 640 "$CONFIG_DIR/config.json"

echo -e "  ${GREEN}✓${NC} Created $CONFIG_DIR/config.json"
echo ""

# Step 3: Update config with instance-specific values
echo -e "${BLUE}[3/5]${NC} Updating configuration..."
# Update backup directory in config
if command -v jq &> /dev/null; then
    TMP_CONFIG=$(mktemp)
    jq ".backup.backup_dir = \"$BACKUP_DIR\"" "$CONFIG_DIR/config.json" > "$TMP_CONFIG"
    mv "$TMP_CONFIG" "$CONFIG_DIR/config.json"
    chown mc-backup:mc-backup "$CONFIG_DIR/config.json"
    echo -e "  ${GREEN}✓${NC} Updated backup_dir to $BACKUP_DIR"
else
    echo -e "  ${YELLOW}⚠${NC} jq not found, skipping auto-update"
    echo -e "  ${YELLOW}→${NC} Please manually update backup_dir in config"
fi
echo ""

# Step 4: Create systemd service
echo -e "${BLUE}[4/5]${NC} Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Minecraft Backup System - ${INSTANCE_NAME}
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=mc-backup
Group=mc-backup
WorkingDirectory=/opt/mc-backup
Environment="NODE_ENV=production"
Environment="CONFIG_PATH=${CONFIG_DIR}/config.json"
ExecStart=/usr/bin/node /opt/mc-backup/src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Resource limits
LimitNOFILE=65536
MemoryLimit=512M

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${BACKUP_DIR} ${CONFIG_DIR} /var/log/mc-backup /var/lib/pterodactyl

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
echo -e "  ${GREEN}✓${NC} Created service ${SERVICE_NAME}.service"
echo ""

# Step 5: Summary and next steps
echo -e "${BLUE}[5/5]${NC} Instance created successfully!"
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    Instance: ${GREEN}${INSTANCE_NAME}${CYAN}                                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📁 Config:   ${CONFIG_DIR}/config.json"
echo -e "💾 Backups:  ${BACKUP_DIR}"
echo -e "📋 Logs:     /var/log/mc-backup/${SERVICE_NAME}.log"
echo -e "⚙️  Service:  ${SERVICE_NAME}.service"
echo ""
echo -e "${YELLOW}⚠  IMPORTANT: Configure before starting!${NC}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo ""
echo -e "${GREEN}1.${NC} Edit the configuration file:"
echo -e "   ${BLUE}sudo nano ${CONFIG_DIR}/config.json${NC}"
echo ""
echo -e "   Update these values:"
echo -e "   • pterodactyl.server_id    → Your server ID"
echo -e "   • pterodactyl.api_key      → Your API key (optional if shared)"
echo -e "   • backup.source_path       → World folder path"
echo -e "   • discord.channels         → Channel IDs for this server"
echo -e "   • backup.schedule          → Stagger from other instances!"
echo ""
echo -e "${GREEN}2.${NC} Verify configuration syntax:"
echo -e "   ${BLUE}cat ${CONFIG_DIR}/config.json | jq${NC}"
echo ""
echo -e "${GREEN}3.${NC} Start the service:"
echo -e "   ${BLUE}sudo systemctl start ${SERVICE_NAME}${NC}"
echo ""
echo -e "${GREEN}4.${NC} Enable auto-start on boot:"
echo -e "   ${BLUE}sudo systemctl enable ${SERVICE_NAME}${NC}"
echo ""
echo -e "${GREEN}5.${NC} Check service status:"
echo -e "   ${BLUE}sudo systemctl status ${SERVICE_NAME}${NC}"
echo ""
echo -e "${GREEN}6.${NC} View logs:"
echo -e "   ${BLUE}sudo journalctl -u ${SERVICE_NAME} -f${NC}"
echo ""
echo -e "${CYAN}Management Commands:${NC}"
echo ""
echo -e "  Stop:    ${BLUE}sudo systemctl stop ${SERVICE_NAME}${NC}"
echo -e "  Restart: ${BLUE}sudo systemctl restart ${SERVICE_NAME}${NC}"
echo -e "  Disable: ${BLUE}sudo systemctl disable ${SERVICE_NAME}${NC}"
echo ""
echo -e "${YELLOW}⚠  Remember to stagger backup schedules!${NC}"
echo -e "   Example schedules for multiple servers:"
echo -e "   • SMP:      0 0,6,12,18 * * *   (00:00, 06:00, 12:00, 18:00)"
echo -e "   • Creative: 0 1,7,13,19 * * *   (01:00, 07:00, 13:00, 19:00)"
echo -e "   • Modded:   0 2,8,14,20 * * *   (02:00, 08:00, 14:00, 20:00)"
echo ""
echo -e "${GREEN}✅ Instance '${INSTANCE_NAME}' is ready!${NC}"
echo ""
