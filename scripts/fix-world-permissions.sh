#!/bin/bash
###############################################################################
# Minecraft World Permission Fix Script
# 
# This script fixes file permissions on Minecraft world files to allow
# the mc-backup user to read them. Minecraft/Pterodactyl creates files
# with restrictive 0600 permissions (owner-only), which prevents backups.
#
# This script is called automatically before each backup operation.
###############################################################################

# Get world path from config
WORLD_PATH=$(grep -oP '"source_path":\s*"\K[^"]+' /etc/mc-backup/config.json 2>/dev/null | head -1)

if [ -z "$WORLD_PATH" ]; then
    echo "Error: Could not find world path in config"
    exit 1
fi

# Extract base directory for multi-world support
WORLD_BASE=$(dirname "$WORLD_PATH")

# Function to fix permissions on a world directory
fix_world_permissions() {
    local world_dir="$1"
    
    if [ ! -d "$world_dir" ]; then
        return
    fi
    
    # Give pterodactyl group read permission on all files
    find "$world_dir" -type f -exec chmod g+r {} \; 2>/dev/null
    
    # Give pterodactyl group execute on all directories (needed to traverse)
    find "$world_dir" -type d -exec chmod g+x {} \; 2>/dev/null
}

# Fix permissions on main world
fix_world_permissions "$WORLD_PATH"

# Check for multi-world structure (Paper/Spigot)
NETHER_PATH="${WORLD_PATH}_nether"
END_PATH="${WORLD_PATH}_the_end"

fix_world_permissions "$NETHER_PATH"
fix_world_permissions "$END_PATH"

exit 0
