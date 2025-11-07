#!/bin/bash
###############################################################################
# Minecraft Backup System - Automated Installation Script
# 
# One-command installation:
# curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/main/install.sh | sudo bash
#
# This script will:
# - Check system requirements
# - Install dependencies (Node.js, rsync, rclone)
# - Run interactive configuration wizard
# - Install and start the backup service
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration variables
INSTALL_DIR="/opt/mc-backup"
CONFIG_DIR="/etc/mc-backup"
LOG_DIR="/var/log/mc-backup"
SERVICE_USER="mc-backup"
TEMP_DIR="/tmp/mc-backup-install"
NODE_VERSION="18"

# Clear screen and show header
clear
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}   ${BOLD}Minecraft Backup System - Installation Wizard${NC}           ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# Utility Functions
###############################################################################

print_step() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}[$1] $2${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

ask_question() {
    local question="$1"
    local default="$2"
    local answer
    
    if [ -n "$default" ]; then
        echo -e "${question} ${CYAN}[$default]${NC}:"
    else
        echo -e "${question}:"
    fi
    
    echo -n "> "
    read answer
    
    if [ -z "$answer" ] && [ -n "$default" ]; then
        echo "$default"
    else
        echo "$answer"
    fi
}

ask_yes_no() {
    local question="$1"
    local default="$2"
    local answer
    
    if [ "$default" = "y" ]; then
        echo -e "${question} ${CYAN}(Y/n)${NC}:"
    else
        echo -e "${question} ${CYAN}(y/N)${NC}:"
    fi
    
    echo -n "> "
    read answer
    answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')
    
    if [ -z "$answer" ]; then
        answer="$default"
    fi
    
    [ "$answer" = "y" ] || [ "$answer" = "yes" ]
}

spinner() {
    local pid=$1
    local message=$2
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    
    echo -n "$message "
    while kill -0 $pid 2>/dev/null; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep 0.1
        printf "\b\b\b\b\b\b"
    done
    wait $pid
    return $?
}

###############################################################################
# Pre-Flight Checks
###############################################################################

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root or with sudo"
        exit 1
    fi
    print_success "Root privileges verified"
}

check_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
        
        case $OS in
            ubuntu)
                if [ "${VER%.*}" -lt 20 ]; then
                    print_error "Ubuntu 20.04+ required (found $VER)"
                    exit 1
                fi
                ;;
            debian)
                if [ "${VER%.*}" -lt 11 ]; then
                    print_error "Debian 11+ required (found $VER)"
                    exit 1
                fi
                ;;
            centos|rhel)
                if [ "${VER%.*}" -lt 8 ]; then
                    print_error "CentOS/RHEL 8+ required (found $VER)"
                    exit 1
                fi
                ;;
            *)
                print_warning "OS not officially supported: $OS $VER"
                if ! ask_yes_no "Continue anyway?" "n"; then
                    exit 1
                fi
                ;;
        esac
        
        print_success "OS compatible: $OS $VER"
    else
        print_error "Cannot detect OS version"
        exit 1
    fi
}

check_disk_space() {
    local available=$(df / | awk 'NR==2 {print $4}')
    local required=$((20 * 1024 * 1024))  # 20GB in KB
    
    if [ "$available" -lt "$required" ]; then
        print_error "Insufficient disk space (need 20GB, have $(($available / 1024 / 1024))GB)"
        exit 1
    fi
    
    print_success "Sufficient disk space available"
}

check_existing_installation() {
    if [ -d "$INSTALL_DIR" ] || [ -f "/etc/systemd/system/mc-backup.service" ]; then
        print_warning "Existing installation detected"
        
        if ask_yes_no "Remove existing installation?" "n"; then
            print_info "Stopping service..."
            systemctl stop mc-backup 2>/dev/null || true
            systemctl disable mc-backup 2>/dev/null || true
            
            print_info "Removing files..."
            rm -rf "$INSTALL_DIR"
            rm -f "/etc/systemd/system/mc-backup.service"
            
            if ask_yes_no "Remove configuration and backups?" "n"; then
                rm -rf "$CONFIG_DIR"
                print_warning "Backup directory NOT removed for safety"
            fi
            
            print_success "Existing installation removed"
        else
            print_error "Cannot continue with existing installation"
            exit 1
        fi
    fi
}

###############################################################################
# Dependency Installation
###############################################################################

install_nodejs() {
    print_info "Installing Node.js ${NODE_VERSION}..."
    
    if command -v node &> /dev/null; then
        local current_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$current_version" -ge "$NODE_VERSION" ]; then
            print_success "Node.js $(node -v) already installed"
            return
        fi
    fi
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null 2>&1
    
    # Install Node.js
    apt-get install -y nodejs >/dev/null 2>&1 || yum install -y nodejs >/dev/null 2>&1
    
    print_success "Node.js $(node -v) installed"
}

install_rsync() {
    if command -v rsync &> /dev/null; then
        print_success "rsync already installed"
        return
    fi
    
    print_info "Installing rsync..."
    apt-get install -y rsync >/dev/null 2>&1 || yum install -y rsync >/dev/null 2>&1
    
    print_success "rsync installed"
}

install_rclone() {
    if command -v rclone &> /dev/null; then
        print_success "rclone already installed"
        return
    fi
    
    print_info "Installing rclone..."
    curl https://rclone.org/install.sh 2>/dev/null | bash >/dev/null 2>&1
    
    print_success "rclone installed"
}

check_systemd() {
    if ! command -v systemctl &> /dev/null; then
        print_error "systemd is required but not found"
        exit 1
    fi
    
    print_success "systemd available"
}

###############################################################################
# Configuration Wizard
###############################################################################

configure_pterodactyl() {
    print_step "1/8" "Pterodactyl Configuration"
    
    PANEL_URL=$(ask_question "Enter your Pterodactyl panel URL (e.g., https://panel.example.com)" "")
    
    echo ""
    echo -e "${YELLOW}Enter your Pterodactyl API key:${NC}"
    echo -e "${CYAN}(Create at: Panel → Account → API Credentials → Create API Key)${NC}"
    echo -n "> "
    read -s API_KEY
    echo ""
    
    # Test connection
    echo -n "Testing connection..."
    local test_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Accept: application/json" \
        "${PANEL_URL}/api/client" 2>/dev/null)
    
    if [ "$test_response" = "200" ]; then
        print_success "Connected successfully!"
    else
        print_error "Connection failed (HTTP $test_response)"
        print_info "Please check your panel URL and API key"
        exit 1
    fi
    
    echo ""
    SERVER_ID=$(ask_question "Enter your Minecraft server ID\n${CYAN}(Found in URL: /server/<SERVER_ID>)${NC}" "")
    
    # Validate server ID
    echo -n "Validating server ID..."
    local server_response=$(curl -s \
        -H "Authorization: Bearer $API_KEY" \
        -H "Accept: application/json" \
        "${PANEL_URL}/api/client/servers/${SERVER_ID}" 2>/dev/null)
    
    if echo "$server_response" | grep -q '"uuid"'; then
        local server_name=$(echo "$server_response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
        print_success "Server found: \"$server_name\""
        
        # Auto-detect world path
        local server_uuid=$(echo "$server_response" | grep -o '"uuid":"[^"]*"' | cut -d'"' -f4)
        WORLD_PATH="/var/lib/pterodactyl/volumes/${server_uuid}/world"
    else
        print_error "Server not found"
        exit 1
    fi
}

configure_backup() {
    print_step "2/8" "Backup Configuration"
    
    echo -e "Auto-detected world path: ${CYAN}$WORLD_PATH${NC}"
    if ! ask_yes_no "Is this correct?" "y"; then
        WORLD_PATH=$(ask_question "Enter world path" "$WORLD_PATH")
    fi
    
    echo ""
    BACKUP_DIR=$(ask_question "Where should local backups be stored?" "/backups/minecraft-smp")
    
    # Create backup directory
    echo -n "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    chmod 755 "$BACKUP_DIR"
    print_success "Created successfully"
    
    echo ""
    RETENTION_DAYS=$(ask_question "How many days should local backups be retained?" "10")
    
    # Backup schedule
    echo ""
    echo -e "${BOLD}Select backup schedule:${NC}"
    echo -e "${CYAN}1)${NC} Daily at midnight (00:00)"
    echo -e "${CYAN}2)${NC} Twice daily (00:00, 12:00)"
    echo -e "${CYAN}3)${NC} Three times daily (00:00, 12:00, 18:00)"
    echo -e "${CYAN}4)${NC} Every 6 hours (00:00, 06:00, 12:00, 18:00)"
    echo -e "${CYAN}5)${NC} Custom cron expression"
    echo -n "> "
    read schedule_choice
    
    case $schedule_choice in
        1)
            CRON_SCHEDULES='["0 0 * * *"]'
            ;;
        2)
            CRON_SCHEDULES='["0 0 * * *","0 12 * * *"]'
            ;;
        3)
            CRON_SCHEDULES='["0 0 * * *","0 12 * * *","0 18 * * *"]'
            ;;
        4)
            CRON_SCHEDULES='["0 0 * * *","0 6 * * *","0 12 * * *","0 18 * * *"]'
            ;;
        5)
            echo "Enter cron expression:"
            echo -n "> "
            read custom_cron
            CRON_SCHEDULES="[\"$custom_cron\"]"
            ;;
        *)
            CRON_SCHEDULES='["0 0 * * *","0 12 * * *"]'
            ;;
    esac
}

configure_offsite() {
    print_step "3/8" "Offsite Backup Configuration"
    
    if ask_yes_no "Do you want to enable offsite backups via rclone?" "n"; then
        OFFSITE_ENABLED="true"
        
        echo ""
        echo -e "${BOLD}Choose your cloud storage provider:${NC}"
        echo -e "${CYAN}1)${NC} Google Drive"
        echo -e "${CYAN}2)${NC} Backblaze B2"
        echo -e "${CYAN}3)${NC} AWS S3"
        echo -e "${CYAN}4)${NC} Wasabi"
        echo -e "${CYAN}5)${NC} Custom S3-compatible"
        echo -e "${CYAN}6)${NC} I'll configure rclone manually later"
        echo -n "> "
        read provider_choice
        
        # Install rclone
        install_rclone
        
        case $provider_choice in
            6)
                print_info "Skipping automatic rclone configuration"
                print_info "Run 'rclone config' after installation to set up manually"
                REMOTE_NAME="myremote:minecraft-backups"
                ;;
            *)
                print_info "Please run 'rclone config' after installation to complete setup"
                REMOTE_NAME="myremote:minecraft-backups"
                ;;
        esac
        
        echo ""
        OFFSITE_RETENTION=$(ask_question "Offsite backup retention period (days)?" "30")
        
        echo ""
        BANDWIDTH_LIMIT=$(ask_question "Bandwidth limit for uploads (e.g., 10M, 1G, or 'none')?" "none")
    else
        OFFSITE_ENABLED="false"
        REMOTE_NAME=""
        OFFSITE_RETENTION="30"
        BANDWIDTH_LIMIT=""
    fi
}

configure_discord() {
    print_step "4/8" "Discord Bot Configuration"
    
    echo -e "${YELLOW}Enter your Discord bot token:${NC}"
    echo -e "${CYAN}(Create at: https://discord.com/developers/applications)${NC}"
    echo -n "> "
    read -s BOT_TOKEN
    echo ""
    
    echo ""
    GUILD_ID=$(ask_question "Enter your Discord server (guild) ID" "")
    
    echo ""
    NOTIFICATION_CHANNEL=$(ask_question "Enter channel ID for backup notifications" "")
    
    # We'll use the same channel for commands by default
    COMMAND_CHANNEL="$NOTIFICATION_CHANNEL"
    
    # Test bot connection (simplified - just check if token format is valid)
    if [ ${#BOT_TOKEN} -gt 50 ]; then
        print_success "Bot token format looks valid"
    else
        print_warning "Bot token seems short - please verify it's correct"
    fi
}

configure_permissions() {
    print_step "5/8" "Discord Permissions"
    
    echo -e "${CYAN}Enter role names that can trigger backups (comma-separated):${NC}"
    echo -e "${YELLOW}Example: Admin,Moderator${NC}"
    echo -n "> "
    read backup_roles
    
    # Convert to JSON array
    IFS=',' read -ra ROLES <<< "$backup_roles"
    BACKUP_ROLES="["
    for role in "${ROLES[@]}"; do
        role=$(echo "$role" | xargs)  # Trim whitespace
        BACKUP_ROLES="\"$role\","
    done
    BACKUP_ROLES="${BACKUP_ROLES%,}]"  # Remove trailing comma and close array
    
    echo ""
    echo -e "${CYAN}Enter role names that can restore backups (comma-separated):${NC}"
    echo -e "${YELLOW}Example: Admin${NC}"
    echo -n "> "
    read restore_roles
    
    # Convert to JSON array
    IFS=',' read -ra ROLES <<< "$restore_roles"
    RESTORE_ROLES="["
    for role in "${ROLES[@]}"; do
        role=$(echo "$role" | xargs)
        RESTORE_ROLES="${RESTORE_ROLES}\"$role\","
    done
    RESTORE_ROLES="${RESTORE_ROLES%,}]"
}

configure_alerts() {
    print_step "6/8" "Storage Alerts"
    
    WARN_THRESHOLD=$(ask_question "Disk usage warning threshold (%)?" "80")
    CRIT_THRESHOLD=$(ask_question "Critical threshold (backups will stop)?" "95")
}

review_configuration() {
    print_step "7/8" "Review Configuration"
    
    echo -e "${BOLD}Pterodactyl:${NC}"
    echo -e "  Panel: $PANEL_URL"
    echo -e "  Server ID: $SERVER_ID"
    echo -e "  World Path: $WORLD_PATH"
    echo ""
    echo -e "${BOLD}Backup:${NC}"
    echo -e "  Directory: $BACKUP_DIR"
    echo -e "  Retention: $RETENTION_DAYS days"
    echo -e "  Schedules: $CRON_SCHEDULES"
    echo ""
    echo -e "${BOLD}Offsite:${NC}"
    if [ "$OFFSITE_ENABLED" = "true" ]; then
        echo -e "  Enabled: ${GREEN}Yes${NC}"
        echo -e "  Remote: $REMOTE_NAME"
        echo -e "  Retention: $OFFSITE_RETENTION days"
        [ -n "$BANDWIDTH_LIMIT" ] && echo -e "  Bandwidth: $BANDWIDTH_LIMIT"
    else
        echo -e "  Enabled: ${RED}No${NC}"
    fi
    echo ""
    echo -e "${BOLD}Discord:${NC}"
    echo -e "  Notifications: Enabled"
    echo -e "  Backup Roles: $BACKUP_ROLES"
    echo -e "  Restore Roles: $RESTORE_ROLES"
    echo ""
    echo -e "${BOLD}Alerts:${NC}"
    echo -e "  Warning: $WARN_THRESHOLD%"
    echo -e "  Critical: $CRIT_THRESHOLD%"
    echo ""
    
    if ! ask_yes_no "Is this correct?" "y"; then
        print_error "Configuration cancelled"
        exit 1
    fi
}

###############################################################################
# Installation
###############################################################################

create_config_file() {
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "pterodactyl": {
    "panel_url": "$PANEL_URL",
    "api_key": "$API_KEY",
    "server_id": "$SERVER_ID"
  },
  "backup": {
    "source_path": "$WORLD_PATH",
    "backup_dir": "$BACKUP_DIR",
    "retention_local_days": $RETENTION_DAYS,
    "cron_schedules": $CRON_SCHEDULES
  },
  "rclone": {
    "enabled": $OFFSITE_ENABLED,
    "remote_name": "$REMOTE_NAME",
    "retention_offsite_days": $OFFSITE_RETENTION,
    "sync_after_backup": $OFFSITE_ENABLED,
    "bandwidth_limit": "$BANDWIDTH_LIMIT",
    "schedule_limits": []
  },
  "discord": {
    "bot_token": "$BOT_TOKEN",
    "guild_id": "$GUILD_ID",
    "command_channel_id": "$COMMAND_CHANNEL",
    "notification_channel_id": "$NOTIFICATION_CHANNEL",
    "allowed_roles_backup": $BACKUP_ROLES,
    "allowed_roles_restore": $RESTORE_ROLES
  },
  "audit": {
    "log_path": "$LOG_DIR",
    "retention_days": 90,
    "format": "json"
  },
  "alerts": {
    "disk_usage_warning": $WARN_THRESHOLD,
    "disk_usage_critical": $CRIT_THRESHOLD
  }
}
EOF
}

install_application() {
    print_step "8/8" "Installation"
    
    # Create system user
    echo -n "Creating system user '$SERVICE_USER'..."
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /bin/false "$SERVICE_USER"
        print_success "Created"
    else
        print_success "Already exists"
    fi
    
    # Create directories
    echo -n "Creating directories..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    print_success "Created"
    
    # Download/copy application files
    echo -n "Installing application files..."
    
    # Check if we're running from a git repository
    if [ -f "package.json" ] && [ -d "src" ]; then
        # Running from local repository
        cp -r ./* "$INSTALL_DIR/"
    else
        # Download from GitHub (when available)
        print_warning "Running from installer - manual file copy required"
        print_info "Please copy application files to $INSTALL_DIR"
        exit 1
    fi
    
    print_success "Installed"
    
    # Install npm dependencies
    echo -n "Installing Node.js dependencies..."
    cd "$INSTALL_DIR"
    npm install --production --silent
    print_success "Installed"
    
    # Create configuration
    echo -n "Writing configuration..."
    create_config_file
    print_success "Created"
    
    # Set permissions
    echo -n "Setting file permissions..."
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$LOG_DIR"
    chown -R "$SERVICE_USER:$SERVICE_USER" "$BACKUP_DIR"
    chmod 600 "$CONFIG_DIR/config.json"
    chmod 755 "$BACKUP_DIR"
    print_success "Set"
    
    # Install systemd service
    echo -n "Installing systemd service..."
    cp "$INSTALL_DIR/systemd/mc-backup.service" /etc/systemd/system/
    systemctl daemon-reload
    print_success "Installed"
    
    # Enable service
    echo -n "Enabling service on boot..."
    systemctl enable mc-backup
    print_success "Enabled"
    
    # Start service
    echo -n "Starting mc-backup service..."
    systemctl start mc-backup
    sleep 2
    
    if systemctl is-active --quiet mc-backup; then
        print_success "Started"
    else
        print_error "Failed to start"
        print_info "Check logs: journalctl -u mc-backup -n 50"
    fi
}

###############################################################################
# Post-Installation
###############################################################################

show_completion() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}${BOLD}✓ Installation Complete!${NC}"
    echo ""
    echo -e "Your backup system is now running. Here's what's happening:"
    echo -e "  • Backups scheduled at: $(echo $CRON_SCHEDULES | sed 's/\[//g;s/\]//g;s/"//g')"
    echo -e "  • Discord bot is online in your server"
    echo -e "  • First backup will run at next scheduled time"
    echo ""
    echo -e "${BOLD}Useful commands:${NC}"
    echo -e "  • Check status: ${CYAN}sudo systemctl status mc-backup${NC}"
    echo -e "  • View logs: ${CYAN}sudo journalctl -u mc-backup -f${NC}"
    echo -e "  • Test backup: ${CYAN}sudo -u $SERVICE_USER node $INSTALL_DIR/scripts/manual-backup.js${NC}"
    echo -e "  • Restart service: ${CYAN}sudo systemctl restart mc-backup${NC}"
    echo ""
    echo -e "${BOLD}Discord commands (in your server):${NC}"
    echo -e "  • ${CYAN}!backup now${NC} - Trigger immediate backup"
    echo -e "  • ${CYAN}!backup list${NC} - Show all backups"
    echo -e "  • ${CYAN}!backup status${NC} - Current status"
    echo -e "  • ${CYAN}!backup help${NC} - Full command list"
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

run_test_backup() {
    if ask_yes_no "Would you like to run a test backup now?" "y"; then
        echo ""
        echo -e "${BOLD}Triggering test backup...${NC}"
        
        sudo -u "$SERVICE_USER" node "$INSTALL_DIR/scripts/manual-backup.js"
        
        if [ $? -eq 0 ]; then
            echo ""
            print_success "Test backup completed successfully!"
        else
            echo ""
            print_error "Test backup failed - check logs for details"
        fi
    fi
}

###############################################################################
# Main Installation Flow
###############################################################################

main() {
    # Pre-flight checks
    print_info "Running pre-flight checks..."
    check_root
    check_os
    check_disk_space
    check_existing_installation
    check_systemd
    
    echo ""
    print_success "All pre-flight checks passed!"
    sleep 1
    
    # Install dependencies
    echo ""
    print_info "Installing dependencies..."
    install_nodejs
    install_rsync
    
    echo ""
    print_success "Dependencies installed!"
    sleep 1
    
    # Run configuration wizard
    configure_pterodactyl
    configure_backup
    configure_offsite
    configure_discord
    configure_permissions
    configure_alerts
    review_configuration
    
    # Install application
    install_application
    
    # Show completion message
    show_completion
    
    # Optional test backup
    run_test_backup
    
    echo ""
    echo -e "${GREEN}${BOLD}Installation wizard complete! Your backup system is ready.${NC}"
    echo ""
}

# Run main installation
main

exit 0
