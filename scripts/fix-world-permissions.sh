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

set -e  # Exit on any error

# Get world path from config
WORLD_PATH=$(grep -oP '"source_path":\s*"\K[^"]+' /etc/mc-backup/config.json 2>/dev/null | head -1)

if [ -z "$WORLD_PATH" ]; then
    echo "Error: Could not find world path in config" >&2
    exit 1
fi

# Function to fix permissions on a world directory
fix_world_permissions() {
    local world_dir="$1"
    local world_name="$2"
    
    if [ ! -d "$world_dir" ]; then
        echo "Warning: $world_name directory not found: $world_dir" >&2
        return 0
    fi
    
    # Give pterodactyl group read permission on all files
    if ! find "$world_dir" -type f -exec chmod g+r {} \; 2>/dev/null; then
        echo "Warning: Failed to set file permissions for $world_name" >&2
    fi
    
    # Give pterodactyl group execute on all directories (needed to traverse)
    if ! find "$world_dir" -type d -exec chmod g+x {} \; 2>/dev/null; then
        echo "Warning: Failed to set directory permissions for $world_name" >&2
    fi
}

# Fix permissions on main world
fix_world_permissions "$WORLD_PATH" "main world"

# Check for multi-world structure (Paper/Spigot)
NETHER_PATH="${WORLD_PATH}_nether"
END_PATH="${WORLD_PATH}_the_end"

fix_world_permissions "$NETHER_PATH" "Nether"
fix_world_permissions "$END_PATH" "End"

echo "Permissions fixed for all world dimensions" >&2
exit 0
