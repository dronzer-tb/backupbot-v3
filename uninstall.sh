#!/bin/bash
###############################################################################
# Minecraft Backup System - Uninstall Script
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

clear
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}   ${BOLD}Minecraft Backup System - Uninstall${NC}                    ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}✗${NC} This script must be run as root or with sudo"
    exit 1
fi

echo -e "${YELLOW}⚠ WARNING: This will remove the Minecraft Backup System${NC}"
echo ""

# Check what exists
INSTALL_DIR="/opt/mc-backup"
CONFIG_DIR="/etc/mc-backup"
LOG_DIR="/var/log/mc-backup"
SERVICE_FILE="/etc/systemd/system/mc-backup.service"

echo -e "${BOLD}Found installations:${NC}"
[ -d "$INSTALL_DIR" ] && echo -e "  ${GREEN}✓${NC} Application files: $INSTALL_DIR"
[ -d "$CONFIG_DIR" ] && echo -e "  ${GREEN}✓${NC} Configuration: $CONFIG_DIR"
[ -d "$LOG_DIR" ] && echo -e "  ${GREEN}✓${NC} Logs: $LOG_DIR"
[ -f "$SERVICE_FILE" ] && echo -e "  ${GREEN}✓${NC} System service: $SERVICE_FILE"

echo ""
echo -e "${BOLD}What would you like to remove?${NC}"
echo ""
echo -e "${CYAN}1)${NC} Complete removal (app + config + logs)"
echo -e "${CYAN}2)${NC} Keep configuration and logs (app only)"
echo -e "${CYAN}3)${NC} Keep everything (cancel)"
echo ""
echo -n "Select option [1-3]: "
read OPTION

case $OPTION in
    3)
        echo -e "${GREEN}Cancelled - nothing removed${NC}"
        exit 0
        ;;
    1|2)
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Stop and disable service
if [ -f "$SERVICE_FILE" ]; then
    echo ""
    echo -e "${BOLD}Stopping service...${NC}"
    systemctl stop mc-backup 2>/dev/null || true
    systemctl disable mc-backup 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Service stopped"
fi

# Remove service file
if [ -f "$SERVICE_FILE" ]; then
    echo -e "${BOLD}Removing service...${NC}"
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    echo -e "${GREEN}✓${NC} Service removed"
fi

# Remove application
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${BOLD}Removing application...${NC}"
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}✓${NC} Application removed"
fi

# Remove user
if id "mc-backup" &>/dev/null; then
    echo -e "${BOLD}Removing system user...${NC}"
    userdel mc-backup 2>/dev/null || true
    echo -e "${GREEN}✓${NC} User removed"
fi

# Detect and remove loop containers
echo ""
echo -e "${BOLD}Checking for loop containers...${NC}"
BACKUP_MOUNT=$(grep -E "^/backups/" /proc/mounts 2>/dev/null | awk '{print $2}' | head -1)
CONTAINER_FILE=""

if [ -n "$BACKUP_MOUNT" ]; then
    echo -e "${GREEN}✓${NC} Found mounted backup container: $BACKUP_MOUNT"
    LOOP_DEVICE=$(grep "$BACKUP_MOUNT" /proc/mounts | awk '{print $1}')
    echo -e "${CYAN}ℹ${NC} Loop device: $LOOP_DEVICE"
    
    # Get container file path
    if [ -n "$LOOP_DEVICE" ]; then
        CONTAINER_FILE=$(losetup -l | grep "$LOOP_DEVICE" | awk '{print $6}')
    fi
    
    echo ""
    echo -e "${YELLOW}⚠ Remove storage container and all backups?${NC}"
    echo -e "${RED}   This will DELETE ALL BACKUP DATA!${NC}"
    echo -n "Remove storage container? (y/N): "
    read DELETE_STORAGE
    
    if [ "$DELETE_STORAGE" = "y" ] || [ "$DELETE_STORAGE" = "Y" ]; then
        echo -e "${BOLD}Unmounting and removing storage container...${NC}"
        
        # Unmount
        umount "$BACKUP_MOUNT" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Unmounted $BACKUP_MOUNT"
        
        # Detach loop device
        if [ -n "$LOOP_DEVICE" ]; then
            losetup -d "$LOOP_DEVICE" 2>/dev/null || true
            echo -e "${GREEN}✓${NC} Detached loop device $LOOP_DEVICE"
        fi
        
        # Remove container file
        if [ -n "$CONTAINER_FILE" ] && [ -f "$CONTAINER_FILE" ]; then
            rm -f "$CONTAINER_FILE"
            echo -e "${GREEN}✓${NC} Deleted container file: $CONTAINER_FILE"
        fi
        
        # Remove mount directory
        if [ -d "$BACKUP_MOUNT" ]; then
            rm -rf "$BACKUP_MOUNT"
            echo -e "${GREEN}✓${NC} Removed mount directory: $BACKUP_MOUNT"
        fi
        
        # Clean up fstab entry
        if grep -q "$BACKUP_MOUNT" /etc/fstab 2>/dev/null; then
            sed -i "\|$BACKUP_MOUNT|d" /etc/fstab
            echo -e "${GREEN}✓${NC} Removed fstab entry"
        fi
        
        echo -e "${GREEN}✓${NC} Storage container completely removed"
    else
        echo -e "${CYAN}ℹ${NC} Storage container kept at $BACKUP_MOUNT"
        echo -e "${CYAN}ℹ${NC} Container file: $CONTAINER_FILE"
    fi
else
    echo -e "${CYAN}ℹ${NC} No mounted backup container found"
fi

# Remove sudoers file
if [ -f "/etc/sudoers.d/mc-backup-permissions" ]; then
    echo ""
    echo -e "${BOLD}Removing sudoers configuration...${NC}"
    rm -f /etc/sudoers.d/mc-backup-permissions
    echo -e "${GREEN}✓${NC} Sudoers file removed"
fi

# Option 1: Remove config and logs
if [ "$OPTION" = "1" ]; then
    if [ -d "$CONFIG_DIR" ]; then
        echo ""
        echo -e "${YELLOW}⚠ Remove configuration (contains API keys and tokens)?${NC}"
        echo -n "Delete $CONFIG_DIR? (y/N): "
        read DELETE_CONFIG
        
        if [ "$DELETE_CONFIG" = "y" ] || [ "$DELETE_CONFIG" = "Y" ]; then
            rm -rf "$CONFIG_DIR"
            echo -e "${GREEN}✓${NC} Configuration removed"
        else
            echo -e "${CYAN}ℹ${NC} Configuration kept at $CONFIG_DIR"
        fi
    fi
    
    if [ -d "$LOG_DIR" ]; then
        echo ""
        echo -e "${YELLOW}⚠ Remove logs?${NC}"
        echo -n "Delete $LOG_DIR? (y/N): "
        read DELETE_LOGS
        
        if [ "$DELETE_LOGS" = "y" ] || [ "$DELETE_LOGS" = "Y" ]; then
            rm -rf "$LOG_DIR"
            echo -e "${GREEN}✓${NC} Logs removed"
        else
            echo -e "${CYAN}ℹ${NC} Logs kept at $LOG_DIR"
        fi
    fi
fi

# Option 2: Keep config and logs
if [ "$OPTION" = "2" ]; then
    echo ""
    echo -e "${CYAN}ℹ${NC} Configuration preserved at $CONFIG_DIR"
    echo -e "${CYAN}ℹ${NC} Logs preserved at $LOG_DIR"
    echo -e "${CYAN}ℹ${NC} You can reinstall later and reuse the same configuration"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Uninstall complete!${NC}"
echo ""

if [ "$OPTION" = "2" ]; then
    echo -e "${BOLD}To reinstall with same configuration:${NC}"
    echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | sudo bash${NC}"
    echo ""
fi

echo -e "${BOLD}Thank you for using Minecraft Backup System!${NC}"
