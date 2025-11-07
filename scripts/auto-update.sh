#!/bin/bash
###############################################################################
# BackupBot Auto-Update Script
# 
# Checks GitHub for updates and installs them
# Can be run manually or via cron/Discord
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO="dronzer-tb/backupbot-v3"
INSTALL_DIR="/opt/mc-backup"
CURRENT_VERSION_FILE="$INSTALL_DIR/VERSION"
GITHUB_API="https://api.github.com/repos/$REPO/commits/master"

# Function to get current version
get_current_version() {
    if [ -f "$CURRENT_VERSION_FILE" ]; then
        cat "$CURRENT_VERSION_FILE"
    else
        echo "unknown"
    fi
}

# Function to get latest version from GitHub
get_latest_version() {
    curl -s "$GITHUB_API" | grep -oP '"sha":\s*"\K[^"]+' | head -1
}

# Function to check for updates
check_updates() {
    echo -e "${CYAN}Checking for updates...${NC}"
    
    CURRENT=$(get_current_version)
    LATEST=$(get_latest_version)
    
    if [ -z "$LATEST" ]; then
        echo -e "${RED}ERROR: Failed to fetch latest version from GitHub${NC}"
        exit 1
    fi
    
    echo "Current: $CURRENT"
    echo "Available: $LATEST"
    
    if [ "$CURRENT" = "$LATEST" ]; then
        echo -e "${GREEN}✓ Already up to date${NC}"
        echo "UP_TO_DATE"
        exit 0
    else
        echo -e "${YELLOW}⚠ Update available!${NC}"
        echo "UPDATE_AVAILABLE"
        echo "Current: $CURRENT"
        echo "Available: $LATEST"
        exit 0
    fi
}

# Function to install update
install_update() {
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Installing BackupBot Update...       ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
    
    # Stop service
    echo -e "${YELLOW}→${NC} Stopping service..."
    systemctl stop mc-backup || true
    
    # Backup current installation
    echo -e "${YELLOW}→${NC} Backing up current installation..."
    BACKUP_DIR="/tmp/mc-backup-backup-$(date +%Y%m%d_%H%M%S)"
    cp -r "$INSTALL_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✓${NC} Backup created: $BACKUP_DIR"
    
    # Save config before updating
    if [ -f "/etc/mc-backup/config.json" ]; then
        cp /etc/mc-backup/config.json /tmp/mc-backup-config-backup.json
    fi
    
    # Check if this is a git repository
    cd "$INSTALL_DIR"
    if [ -d ".git" ]; then
        # Git repository - use git pull
        echo -e "${YELLOW}→${NC} Pulling latest code from GitHub (git)..."
        git fetch origin
        git reset --hard origin/master
    else
        # Not a git repo - download latest release
        echo -e "${YELLOW}→${NC} Downloading latest code from GitHub (archive)..."
        TEMP_DIR="/tmp/mc-backup-download-$$"
        mkdir -p "$TEMP_DIR"
        
        # Download and extract
        curl -sL "https://github.com/$REPO/archive/refs/heads/master.tar.gz" | tar xz -C "$TEMP_DIR"
        
        # Remove old files (except config and data)
        cd "$INSTALL_DIR"
        find . -mindepth 1 -maxdepth 1 ! -name 'node_modules' ! -name 'data' -exec rm -rf {} +
        
        # Copy new files
        cp -r "$TEMP_DIR"/backupbot-v3-master/* "$INSTALL_DIR/"
        rm -rf "$TEMP_DIR"
    fi
    
    # Restore config
    if [ -f "/tmp/mc-backup-config-backup.json" ]; then
        cp /tmp/mc-backup-config-backup.json /etc/mc-backup/config.json
        rm /tmp/mc-backup-config-backup.json
    fi
    
    echo -e "${GREEN}✓${NC} Code updated"
    
    # Install dependencies
    echo -e "${YELLOW}→${NC} Installing dependencies..."
    npm install --production --silent 2>&1 | grep -v "npm WARN" || true
    echo -e "${GREEN}✓${NC} Dependencies installed"
    
    # Set correct permissions
    echo -e "${YELLOW}→${NC} Setting permissions..."
    chown -R mc-backup:mc-backup "$INSTALL_DIR"
    chmod +x "$INSTALL_DIR/scripts/"*.sh
    echo -e "${GREEN}✓${NC} Permissions set"
    
    # Update version file
    LATEST=$(get_latest_version)
    echo "$LATEST" > "$CURRENT_VERSION_FILE"
    chown mc-backup:mc-backup "$CURRENT_VERSION_FILE"
    
    # Restart service
    echo -e "${YELLOW}→${NC} Restarting service..."
    systemctl start mc-backup
    sleep 3
    
    # Verify service is running
    if systemctl is-active --quiet mc-backup; then
        echo -e "${GREEN}✓${NC} Service restarted successfully"
        
        # Additional health check - verify bot is responsive
        sleep 2
        if journalctl -u mc-backup -n 20 --no-pager | grep -q "Bot logged in\|Ready"; then
            echo -e "${GREEN}✓${NC} Bot is online and ready"
        else
            echo -e "${YELLOW}⚠${NC} Service started but waiting for bot to be ready..."
        fi
    else
        echo -e "${RED}✗${NC} Service failed to start, rolling back..."
        
        # Rollback
        rm -rf "$INSTALL_DIR"
        cp -r "$BACKUP_DIR" "$INSTALL_DIR"
        systemctl start mc-backup
        
        echo -e "${RED}ERROR: Update failed, rolled back to previous version${NC}"
        exit 1
    fi
    
    # Cleanup backup
    rm -rf "$BACKUP_DIR"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ Update Complete!                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Updated to version: $LATEST"
    echo ""
    echo -e "${CYAN}Changelog:${NC}"
    echo "View changes at: https://github.com/$REPO/commit/$LATEST"
}

# Main script
case "${1:-check}" in
    check)
        check_updates
        ;;
    install)
        install_update
        ;;
    *)
        echo "Usage: $0 {check|install}"
        echo ""
        echo "  check   - Check if updates are available"
        echo "  install - Install available update"
        exit 1
        ;;
esac
