#!/bin/bash
###############################################################################
# Minecraft Backup System - Automated Installation Script
# 
# One-command installation:
# curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | sudo bash
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
    read -r answer < /dev/tty
    
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
    read -r answer < /dev/tty
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
        echo ""
        echo -e "${BOLD}What would you like to do?${NC}"
        echo -e "${CYAN}1)${NC} Update existing installation (keep configuration)"
        echo -e "${CYAN}2)${NC} Fresh install (remove and reinstall)"
        echo -e "${CYAN}3)${NC} Uninstall only"
        echo -e "${CYAN}4)${NC} Cancel"
        echo ""
        echo -n "Select option [1-4]: "
        read -r INSTALL_OPTION < /dev/tty
        
        case $INSTALL_OPTION in
            1)
                print_info "Updating existing installation..."
                print_info "Configuration will be preserved"
                # Stop service but keep config
                systemctl stop mc-backup 2>/dev/null || true
                # Will reinstall files but keep config
                print_success "Ready to update"
                ;;
            2)
                print_warning "This will remove the existing installation"
                if ask_yes_no "Continue with fresh install?" "y"; then
                    print_info "Stopping service..."
                    systemctl stop mc-backup 2>/dev/null || true
                    systemctl disable mc-backup 2>/dev/null || true
                    
                    print_info "Removing files..."
                    rm -rf "$INSTALL_DIR"
                    rm -f "/etc/systemd/system/mc-backup.service"
                    
                    if ask_yes_no "Remove configuration?" "n"; then
                        rm -rf "$CONFIG_DIR"
                    fi
                    
                    print_success "Existing installation removed"
                else
                    print_info "Installation cancelled"
                    exit 0
                fi
                ;;
            3)
                print_info "Running uninstaller..."
                if [ -f "$(dirname "$0")/uninstall.sh" ]; then
                    bash "$(dirname "$0")/uninstall.sh"
                else
                    print_warning "uninstall.sh not found"
                    print_info "Manual uninstall: systemctl stop mc-backup && rm -rf $INSTALL_DIR"
                fi
                exit 0
                ;;
            4|*)
                print_info "Installation cancelled"
                exit 0
                ;;
        esac
    fi
}

###############################################################################
# Dependency Installation
###############################################################################

install_curl() {
    if command -v curl &> /dev/null; then
        return
    fi
    
    print_info "Installing curl..."
    apt-get install -y curl >/dev/null 2>&1 || yum install -y curl >/dev/null 2>&1
    print_success "curl installed"
}

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
    
    # Get Panel URL
    while true; do
        echo -e "Enter your Pterodactyl panel URL (e.g., ${CYAN}https://panel.example.com${NC}):"
        echo -n "> "
        read -r PANEL_URL < /dev/tty
        
        if [ -z "$PANEL_URL" ]; then
            print_warning "Panel URL is required"
            continue
        fi
        
        # Remove trailing slash if present
        PANEL_URL="${PANEL_URL%/}"
        break
    done
    
    echo ""
    
    # Get API Key
    while true; do
        echo -e "${YELLOW}Enter your Pterodactyl API key:${NC}"
        echo -e "${CYAN}(Create at: Panel → Account → API Credentials → Create API Key)${NC}"
        echo -n "> "
        read -r -s API_KEY < /dev/tty
        echo ""
        
        if [ -z "$API_KEY" ]; then
            print_warning "API key is required"
            continue
        fi
        break
    done
    
    # Test connection
    echo ""
    echo -n "Testing connection..."
    
    local test_response
    test_response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Accept: application/json" \
        "${PANEL_URL}/api/client" 2>/dev/null || echo "000")
    
    if [ "$test_response" = "200" ]; then
        echo ""
        print_success "Connected successfully!"
    else
        echo ""
        print_error "Connection failed (HTTP $test_response)"
        print_warning "Common issues:"
        print_warning "  • Check that panel URL is correct (${PANEL_URL})"
        print_warning "  • Verify API key is valid and not expired"
        print_warning "  • Ensure panel is accessible from this server"
        
        if ask_yes_no "Try again with different credentials?" "y"; then
            configure_pterodactyl
            return
        else
            print_info "Installation cancelled"
            exit 1
        fi
    fi
    
    echo ""
    
    # Get Server ID
    while true; do
        echo ""
        echo -e "Enter your Minecraft server ID:"
        echo -e "${CYAN}(Found in URL: /server/<SERVER_ID>)${NC}"
        echo -n "> "
        read -r SERVER_ID < /dev/tty
        
        if [ -z "$SERVER_ID" ]; then
            print_warning "Server ID is required"
            continue
        fi
        
        # Validate server ID
        echo -n "Validating server ID..."
        
        local server_response
        server_response=$(curl -s \
            -H "Authorization: Bearer $API_KEY" \
            -H "Accept: application/json" \
            "${PANEL_URL}/api/client/servers/${SERVER_ID}" 2>/dev/null || echo "{}")
        
        if echo "$server_response" | grep -q '"uuid"'; then
            local server_name=$(echo "$server_response" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
            echo ""
            print_success "Server found: \"$server_name\""
            
            # Auto-detect world path
            local server_uuid=$(echo "$server_response" | grep -o '"uuid":"[^"]*"' | head -1 | cut -d'"' -f4)
            WORLD_PATH="/var/lib/pterodactyl/volumes/${server_uuid}/world"
            break
        else
            echo ""
            print_error "Server not found"
            print_warning "Please check the server ID and try again"
            
            if ! ask_yes_no "Try again?" "y"; then
                print_info "Installation cancelled"
                exit 1
            fi
        fi
    done
}

detect_multi_world() {
    local base_path="$1"
    local nether_path="${base_path}_nether"
    local end_path="${base_path}_the_end"
    
    # Check if Paper-style multi-world structure exists
    if [ -d "$nether_path" ] && [ -d "$end_path" ]; then
        echo "multi"
        return 0
    else
        echo "single"
        return 0
    fi
}

configure_backup() {
    print_step "2/8" "Backup Configuration"
    
    # Detect world type
    local world_type=$(detect_multi_world "$WORLD_PATH")
    
    echo -e "${BOLD}World Structure Detection${NC}"
    echo ""
    echo -e "Auto-detected base world path: ${CYAN}$WORLD_PATH${NC}"
    echo ""
    
    if [ "$world_type" = "multi" ]; then
        print_success "✓ Detected Paper/Spigot-based multi-world setup:"
        echo -e "  ${GREEN}✓${NC} $WORLD_PATH ${CYAN}(Overworld)${NC}"
        echo -e "  ${GREEN}✓${NC} ${WORLD_PATH}_nether ${CYAN}(Nether)${NC}"
        echo -e "  ${GREEN}✓${NC} ${WORLD_PATH}_the_end ${CYAN}(The End)${NC}"
        echo ""
        echo -e "${YELLOW}Note: All three world folders will be backed up together${NC}"
        echo ""
        
        if ! ask_yes_no "Is this correct?" "y"; then
            echo ""
            print_warning "Manual world path configuration"
            echo ""
            echo -e "Enter the base world path ${CYAN}[$WORLD_PATH]${NC}:"
            echo -n "> "
            read -r custom_path < /dev/tty
            if [ -n "$custom_path" ]; then
                WORLD_PATH="$custom_path"
                # Re-detect after manual entry
                world_type=$(detect_multi_world "$WORLD_PATH")
                if [ "$world_type" = "multi" ]; then
                    echo ""
                    print_success "Multi-world setup detected at custom path"
                fi
            fi
        fi
    else
        print_info "Single world structure detected"
        echo -e "  World path: ${CYAN}$WORLD_PATH${NC}"
        echo ""
        
        # Check if user might have a different structure
        echo -e "${YELLOW}Common server types:${NC}"
        echo -e "  • ${CYAN}Vanilla/Forge/Fabric${NC}: Single 'world' folder"
        echo -e "  • ${CYAN}Paper/Spigot${NC}: 'world', 'world_nether', 'world_the_end'"
        echo -e "  • ${CYAN}Modded (custom)${NC}: Custom world folder name"
        echo ""
        
        if ! ask_yes_no "Is the detected path correct?" "y"; then
            echo ""
            echo -e "Enter world path ${CYAN}[$WORLD_PATH]${NC}:"
            echo -n "> "
            read -r custom_path < /dev/tty
            if [ -n "$custom_path" ]; then
                WORLD_PATH="$custom_path"
                # Re-detect after manual entry
                world_type=$(detect_multi_world "$WORLD_PATH")
                if [ "$world_type" = "multi" ]; then
                    echo ""
                    print_success "Multi-world setup detected at custom path!"
                    echo -e "  ${GREEN}✓${NC} $WORLD_PATH"
                    echo -e "  ${GREEN}✓${NC} ${WORLD_PATH}_nether"
                    echo -e "  ${GREEN}✓${NC} ${WORLD_PATH}_the_end"
                fi
            fi
        fi
    fi
    
    echo ""
    echo -e "Where should local backups be stored? ${CYAN}[/backups/minecraft-smp]${NC}:"
    echo -n "> "
    read -r BACKUP_DIR < /dev/tty
    
    # Handle common inputs
    if [ -z "$BACKUP_DIR" ] || [ "$BACKUP_DIR" = "y" ] || [ "$BACKUP_DIR" = "Y" ]; then
        BACKUP_DIR="/backups/minecraft-smp"
    fi
    
    # Create backup directory (will be remounted if using allocated storage)
    echo ""
    echo -n "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    chmod 755 "$BACKUP_DIR"
    print_success "Created"
    
    echo ""
    echo -e "How many days should local backups be retained? ${CYAN}[10]${NC}:"
    echo -n "> "
    read -r RETENTION_DAYS < /dev/tty
    if [ -z "$RETENTION_DAYS" ]; then
        RETENTION_DAYS="10"
    fi
    
    # Backup schedule
    echo ""
    echo -e "${BOLD}Select backup schedule:${NC}"
    echo -e "${CYAN}1)${NC} Daily at midnight (00:00)"
    echo -e "${CYAN}2)${NC} Twice daily (00:00, 12:00)"
    echo -e "${CYAN}3)${NC} Three times daily (00:00, 12:00, 18:00)"
    echo -e "${CYAN}4)${NC} Every 6 hours (00:00, 06:00, 12:00, 18:00)"
    echo -e "${CYAN}5)${NC} Custom cron expression"
    echo -n "> "
    read -r schedule_choice < /dev/tty
    
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
            read -r custom_cron < /dev/tty
            CRON_SCHEDULES="[\"$custom_cron\"]"
            ;;
        *)
            CRON_SCHEDULES='["0 0 * * *","0 12 * * *"]'
            ;;
    esac
    
    # Multi-server detection
    echo ""
    echo -e "${BOLD}Server Setup Information:${NC}"
    echo ""
    if [ "$world_type" = "multi" ]; then
        print_info "Multi-world detected: Paper/Spigot server with separate dimension folders"
    else
        print_info "Single world detected: Vanilla or single-folder server"
    fi
    
    echo ""
    echo -e "${CYAN}Do you have multiple Minecraft servers on this VPS?${NC}"
    echo -e "${YELLOW}If yes, you can create additional instances later using:${NC}"
    echo -e "${YELLOW}  sudo /opt/mc-backup/scripts/create-instance.sh <name>${NC}"
    echo ""
    if ask_yes_no "Is this your first/only server?" "y"; then
        INSTANCE_NAME="default"
        print_info "This will be your primary backup instance"
    else
        echo ""
        echo -e "${CYAN}Enter a name for this server instance:${NC}"
        echo -e "${YELLOW}Examples: smp, creative, modded, survival${NC}"
        echo -n "> "
        read -r INSTANCE_NAME < /dev/tty
        if [ -z "$INSTANCE_NAME" ]; then
            INSTANCE_NAME="default"
        fi
        print_info "Instance name: $INSTANCE_NAME"
        print_warning "Remember to stagger backup schedules for multiple servers!"
    fi
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
        read -r provider_choice < /dev/tty
        
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
        echo -e "Offsite backup retention period (days)? ${CYAN}[30]${NC}:"
        echo -n "> "
        read -r OFFSITE_RETENTION < /dev/tty
        if [ -z "$OFFSITE_RETENTION" ]; then
            OFFSITE_RETENTION="30"
        fi
        
        echo ""
        echo -e "Bandwidth limit for uploads (e.g., 10M, 1G, or 'none')? ${CYAN}[none]${NC}:"
        echo -n "> "
        read -r BANDWIDTH_LIMIT < /dev/tty
        if [ -z "$BANDWIDTH_LIMIT" ]; then
            BANDWIDTH_LIMIT="none"
        fi
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
    read -r -s BOT_TOKEN < /dev/tty
    echo ""
    
    echo ""
    echo -e "Enter your Discord server (guild) ID:"
    echo -n "> "
    read -r GUILD_ID < /dev/tty
    
    echo ""
    echo -e "Enter channel ID for backup notifications:"
    echo -n "> "
    read -r NOTIFICATION_CHANNEL < /dev/tty
    
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
    read -r backup_roles < /dev/tty
    
    # Convert to JSON array
    IFS=',' read -ra ROLES <<< "$backup_roles"
    BACKUP_ROLES="["
    for role in "${ROLES[@]}"; do
        role=$(echo "$role" | xargs)  # Trim whitespace
        BACKUP_ROLES="${BACKUP_ROLES}\"$role\","
    done
    BACKUP_ROLES="${BACKUP_ROLES%,}]"  # Remove trailing comma and close array
    
    echo ""
    echo -e "${CYAN}Enter role names that can restore backups (comma-separated):${NC}"
    echo -e "${YELLOW}Example: Admin${NC}"
    echo -n "> "
    read -r restore_roles < /dev/tty
    
    # Convert to JSON array
    IFS=',' read -ra ROLES <<< "$restore_roles"
    RESTORE_ROLES="["
    for role in "${ROLES[@]}"; do
        role=$(echo "$role" | xargs)
        RESTORE_ROLES="${RESTORE_ROLES}\"$role\","
    done
    RESTORE_ROLES="${RESTORE_ROLES%,}]"
}

configure_storage_allocation() {
    print_step "6/8" "Storage Allocation"
    
    echo -e "${BOLD}Storage Allocation Strategy${NC}"
    echo ""
    echo -e "Would you like to allocate a dedicated storage quota for backups?"
    echo -e "${CYAN}This creates an isolated storage container that prevents backups from filling your entire VPS disk.${NC}"
    echo ""
    
    if ask_yes_no "Enable dedicated storage allocation?" "y"; then
        USE_ALLOCATED_STORAGE="true"
        
        # Get available disk space
        local available_gb=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
        
        echo ""
        echo -e "${BOLD}Available disk space: ${GREEN}${available_gb}GB${NC}"
        echo ""
        
        while true; do
            echo -e "How much storage (in GB) should be allocated for backups? ${CYAN}[50]${NC}:"
            echo -n "> "
            read -r STORAGE_ALLOCATION < /dev/tty
            
            if [ -z "$STORAGE_ALLOCATION" ]; then
                STORAGE_ALLOCATION="50"
            fi
            
            # Validate input is a number
            if ! [[ "$STORAGE_ALLOCATION" =~ ^[0-9]+$ ]]; then
                print_error "Please enter a valid number"
                continue
            fi
            
            # Check if enough space available
            if [ "$STORAGE_ALLOCATION" -gt "$available_gb" ]; then
                print_error "Not enough space available (requested: ${STORAGE_ALLOCATION}GB, available: ${available_gb}GB)"
                continue
            fi
            
            # Warn if allocation is too high
            local recommended_max=$((available_gb * 70 / 100))
            if [ "$STORAGE_ALLOCATION" -gt "$recommended_max" ]; then
                print_warning "You're allocating ${STORAGE_ALLOCATION}GB out of ${available_gb}GB available"
                print_warning "Recommended maximum: ${recommended_max}GB (70% of available space)"
                
                if ! ask_yes_no "Continue anyway?" "n"; then
                    continue
                fi
            fi
            
            break
        done
        
        print_success "Storage quota set to ${STORAGE_ALLOCATION}GB"
        
        # Create loopback container
        echo ""
        echo -e "${CYAN}Creating storage container (${STORAGE_ALLOCATION}GB)...${NC}"
        echo -e "${YELLOW}This may take several minutes depending on disk speed${NC}"
        echo ""
        
        local container_path="/opt/mc-backup/backups.img"
        local mount_point="$BACKUP_DIR"
        
        # Ensure parent directory exists
        mkdir -p /opt/mc-backup
        
        # Create container file with progress bar
        echo -e "Writing ${STORAGE_ALLOCATION}GB to disk..."
        if ! dd if=/dev/zero of="$container_path" bs=1M count=$((STORAGE_ALLOCATION * 1024)) status=progress 2>&1; then
            echo ""
            print_error "Failed to create storage container"
            print_warning "Falling back to system disk monitoring"
            USE_ALLOCATED_STORAGE="false"
            STORAGE_ALLOCATION="0"
            
            # Ask for thresholds instead
            echo ""
            echo -e "Disk usage warning threshold (%)? ${CYAN}[80]${NC}:"
            echo -n "> "
            read -r WARN_THRESHOLD < /dev/tty
            if [ -z "$WARN_THRESHOLD" ]; then
                WARN_THRESHOLD="80"
            fi
            
            echo ""
            echo -e "Critical threshold (backups will stop)? ${CYAN}[95]${NC}:"
            echo -n "> "
            read -r CRIT_THRESHOLD < /dev/tty
            if [ -z "$CRIT_THRESHOLD" ]; then
                CRIT_THRESHOLD="95"
            fi
            
            return
        fi
        
        echo ""
        print_success "Container file created"
        
        # Format as ext4
        echo ""
        echo -e "Formatting storage container as ext4..."
        if ! mkfs.ext4 -q "$container_path" 2>&1; then
            echo ""
            print_error "Failed to format storage container"
            print_warning "Removing incomplete container and falling back to system disk"
            rm -f "$container_path"
            USE_ALLOCATED_STORAGE="false"
            STORAGE_ALLOCATION="0"
            
            # Ask for thresholds instead
            echo ""
            echo -e "Disk usage warning threshold (%)? ${CYAN}[80]${NC}:"
            echo -n "> "
            read -r WARN_THRESHOLD < /dev/tty
            if [ -z "$WARN_THRESHOLD" ]; then
                WARN_THRESHOLD="80"
            fi
            
            echo ""
            echo -e "Critical threshold (backups will stop)? ${CYAN}[95]${NC}:"
            echo -n "> "
            read -r CRIT_THRESHOLD < /dev/tty
            if [ -z "$CRIT_THRESHOLD" ]; then
                CRIT_THRESHOLD="95"
            fi
            
            return
        fi
        
        print_success "Filesystem created"
        
        # Mount the container
        echo ""
        echo -e "Mounting storage container..."
        mkdir -p "$mount_point"
        if ! mount -o loop "$container_path" "$mount_point" 2>&1; then
            echo ""
            print_error "Failed to mount storage container"
            print_warning "Removing incomplete container and falling back to system disk"
            rm -f "$container_path"
            USE_ALLOCATED_STORAGE="false"
            STORAGE_ALLOCATION="0"
            
            # Ask for thresholds instead
            echo ""
            echo -e "Disk usage warning threshold (%)? ${CYAN}[80]${NC}:"
            echo -n "> "
            read -r WARN_THRESHOLD < /dev/tty
            if [ -z "$WARN_THRESHOLD" ]; then
                WARN_THRESHOLD="80"
            fi
            
            echo ""
            echo -e "Critical threshold (backups will stop)? ${CYAN}[95]${NC}:"
            echo -n "> "
            read -r CRIT_THRESHOLD < /dev/tty
            if [ -z "$CRIT_THRESHOLD" ]; then
                CRIT_THRESHOLD="95"
            fi
            
            return
        fi
        
        print_success "Created and mounted"
        
        # Add to fstab for persistent mount
        echo ""
        echo -n "Adding to /etc/fstab for persistent mount..."
        
        # Check if already in fstab
        if ! grep -q "$container_path" /etc/fstab 2>/dev/null; then
            echo "$container_path $mount_point ext4 loop,defaults 0 0" >> /etc/fstab
            print_success "Added"
        else
            print_success "Already configured"
        fi
        
        # Set thresholds based on allocated storage
        WARN_THRESHOLD="80"
        CRIT_THRESHOLD="95"
        
        echo ""
        print_info "Allocated storage: ${STORAGE_ALLOCATION}GB"
        print_info "Warning threshold: ${WARN_THRESHOLD}% (${STORAGE_ALLOCATION}GB × 0.80 = $((STORAGE_ALLOCATION * 80 / 100))GB)"
        print_info "Critical threshold: ${CRIT_THRESHOLD}% (${STORAGE_ALLOCATION}GB × 0.95 = $((STORAGE_ALLOCATION * 95 / 100))GB)"
        
    else
        USE_ALLOCATED_STORAGE="false"
        STORAGE_ALLOCATION="0"
        
        echo ""
        echo -e "${YELLOW}Using system disk monitoring instead${NC}"
        echo ""
        echo -e "Disk usage warning threshold (%)? ${CYAN}[80]${NC}:"
        echo -n "> "
        read -r WARN_THRESHOLD < /dev/tty
        if [ -z "$WARN_THRESHOLD" ]; then
            WARN_THRESHOLD="80"
        fi
        
        echo ""
        echo -e "Critical threshold (backups will stop)? ${CYAN}[95]${NC}:"
        echo -n "> "
        read -r CRIT_THRESHOLD < /dev/tty
        if [ -z "$CRIT_THRESHOLD" ]; then
            CRIT_THRESHOLD="95"
        fi
    fi
}

review_configuration() {
    print_step "7/8" "Review Configuration"
    
    echo -e "${BOLD}Pterodactyl:${NC}"
    echo -e "  Panel: $PANEL_URL"
    echo -e "  Server ID: $SERVER_ID"
    echo -e "  World Path: $WORLD_PATH"
    if [ "$world_type" = "multi" ]; then
        echo -e "  Server Type: ${CYAN}Paper/Spigot (Multi-world)${NC}"
    else
        echo -e "  Server Type: ${CYAN}Vanilla/Single-world${NC}"
    fi
    [ "$INSTANCE_NAME" != "default" ] && echo -e "  Instance: ${CYAN}$INSTANCE_NAME${NC}"
    echo ""
    echo -e "${BOLD}Backup:${NC}"
    echo -e "  Directory: $BACKUP_DIR"
    echo -e "  Retention: $RETENTION_DAYS days"
    echo -e "  Schedules: $CRON_SCHEDULES"
    echo ""
    echo -e "${BOLD}Storage:${NC}"
    if [ "$USE_ALLOCATED_STORAGE" = "true" ]; then
        echo -e "  Allocation: ${GREEN}${STORAGE_ALLOCATION}GB dedicated quota${NC}"
        echo -e "  Container: /opt/mc-backup/backups.img"
        echo -e "  Warning: ${WARN_THRESHOLD}%"
        echo -e "  Critical: ${CRIT_THRESHOLD}%"
    else
        echo -e "  Allocation: ${YELLOW}System disk (no quota)${NC}"
        echo -e "  Warning: ${WARN_THRESHOLD}%"
        echo -e "  Critical: ${CRIT_THRESHOLD}%"
    fi
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
    "container_path": "/home/container/world",
    "use_container_path": false,
    "backup_dir": "$BACKUP_DIR",
    "max_backup_size_gb": $STORAGE_ALLOCATION,
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
    "disk_usage_critical": $CRIT_THRESHOLD,
    "use_allocated_storage": $USE_ALLOCATED_STORAGE
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
        print_success "Installed"
    else
        # Download from GitHub
        echo ""
        print_info "Downloading from GitHub..."
        
        # Create temp directory
        GITHUB_TEMP="/tmp/backupbot-download-$$"
        mkdir -p "$GITHUB_TEMP"
        
        # Download and extract
        if command -v wget &> /dev/null; then
            wget -q -O "$GITHUB_TEMP/repo.tar.gz" https://github.com/dronzer-tb/backupbot-v3/archive/refs/heads/master.tar.gz
        elif command -v curl &> /dev/null; then
            curl -fsSL -o "$GITHUB_TEMP/repo.tar.gz" https://github.com/dronzer-tb/backupbot-v3/archive/refs/heads/master.tar.gz
        else
            print_error "Neither wget nor curl found"
            exit 1
        fi
        
        # Extract and copy
        tar -xzf "$GITHUB_TEMP/repo.tar.gz" -C "$GITHUB_TEMP"
        cp -r "$GITHUB_TEMP"/backupbot-v3-master/* "$INSTALL_DIR/"
        
        # Cleanup
        rm -rf "$GITHUB_TEMP"
        print_success "Installed"
    fi
    
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
    chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/config.json"
    chmod 755 "$CONFIG_DIR"
    chmod 640 "$CONFIG_DIR/config.json"
    chmod 755 "$BACKUP_DIR"
    chmod 755 "$LOG_DIR"
    print_success "Set"
    
    # Create permission fix script
    echo -n "Creating permission fix script..."
    cat > "$INSTALL_DIR/scripts/fix-world-permissions.sh" << 'EOF'
#!/bin/bash
# Fix permissions on Minecraft world files
# This allows the mc-backup user to read world files created by Pterodactyl

# Get world path from config
WORLD_PATH=$(grep -oP '"source_path":\s*"\K[^"]+' /etc/mc-backup/config.json | head -1)
WORLD_BASE=$(dirname "$WORLD_PATH")

if [ -z "$WORLD_PATH" ]; then
    echo "Error: Could not find world path in config"
    exit 1
fi

# Give pterodactyl group read permission on all files
[ -d "$WORLD_PATH" ] && find "$WORLD_PATH" -type f -exec chmod g+r {} \; 2>/dev/null

# Check for multi-world structure (Paper/Spigot)
NETHER_PATH="${WORLD_PATH}_nether"
END_PATH="${WORLD_PATH}_the_end"

[ -d "$NETHER_PATH" ] && find "$NETHER_PATH" -type f -exec chmod g+r {} \; 2>/dev/null
[ -d "$END_PATH" ] && find "$END_PATH" -type f -exec chmod g+r {} \; 2>/dev/null

# Give pterodactyl group execute on all directories (needed to traverse)
[ -d "$WORLD_PATH" ] && find "$WORLD_PATH" -type d -exec chmod g+x {} \; 2>/dev/null
[ -d "$NETHER_PATH" ] && find "$NETHER_PATH" -type d -exec chmod g+x {} \; 2>/dev/null
[ -d "$END_PATH" ] && find "$END_PATH" -type d -exec chmod g+x {} \; 2>/dev/null

exit 0
EOF
    chmod +x "$INSTALL_DIR/scripts/fix-world-permissions.sh"
    print_success "Created"
    
    # Add mc-backup to pterodactyl group
    echo -n "Adding $SERVICE_USER to pterodactyl group..."
    if getent group pterodactyl >/dev/null 2>&1; then
        usermod -aG pterodactyl "$SERVICE_USER"
        print_success "Added"
    else
        print_warning "pterodactyl group not found (will skip permission fixes)"
    fi
    
    # Configure sudoers for permission fix
    echo -n "Configuring sudo permissions..."
    cat > /etc/sudoers.d/mc-backup-permissions << EOF
# Allow mc-backup user to fix world file permissions without password
$SERVICE_USER ALL=(ALL) NOPASSWD: $INSTALL_DIR/scripts/fix-world-permissions.sh
EOF
    chmod 440 /etc/sudoers.d/mc-backup-permissions
    print_success "Configured"
    
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
    echo -e "  • Backups scheduled at: $(echo "$CRON_SCHEDULES" | sed 's/\[//g;s/\]//g;s/"//g')"
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
    install_curl
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
    configure_storage_allocation
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
