# 🐛 Installer Bug Fixes - v1.1.1

## Issues Found

### 1. **Critical JSON Syntax Error** ❌
**Location**: `install.sh` line 642  
**Bug**: Array generation missing opening bracket  
**Result**: Invalid JSON causing config parse error

**Before:**
```bash
for role in "${ROLES[@]}"; do
    role=$(echo "$role" | xargs)
    BACKUP_ROLES="\"$role\","  # Missing concatenation!
done
```

**Generated JSON:**
```json
"allowed_roles_backup": "Admin"],  // Invalid! String instead of array
```

**After:**
```bash
for role in "${ROLES[@]}"; do
    role=$(echo "$role" | xargs)
    BACKUP_ROLES="${BACKUP_ROLES}\"$role\","  # Fixed!
done
```

**Generated JSON:**
```json
"allowed_roles_backup": ["Admin"],  // Valid!
```

---

### 2. **Missing v1.1.0 Prompts** ⚠️
**Issue**: Installer didn't ask about:
- Server software type (Paper vs Vanilla)
- Multiple server setups
- Instance naming

**Result**: Users unaware of multi-world and multi-server features

---

## Fixes Applied

### ✅ Fix 1: JSON Array Generation
**File**: `install.sh:642`

Changed:
```bash
BACKUP_ROLES="\"$role\","
```

To:
```bash
BACKUP_ROLES="${BACKUP_ROLES}\"$role\","
```

This properly concatenates roles into an array instead of overwriting.

---

### ✅ Fix 2: Multi-Server Detection
**File**: `install.sh` (after backup schedule)

Added new section:
```bash
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
    read INSTANCE_NAME
    if [ -z "$INSTANCE_NAME" ]; then
        INSTANCE_NAME="default"
    fi
    print_info "Instance name: $INSTANCE_NAME"
    print_warning "Remember to stagger backup schedules for multiple servers!"
fi
```

**Benefits:**
- Informs user about multi-world detection
- Prompts for multi-server setup
- Provides instance naming
- Shows command for adding more servers later

---

### ✅ Fix 3: Enhanced Review Screen
**File**: `install.sh` review section

Added to configuration review:
```bash
if [ "$world_type" = "multi" ]; then
    echo -e "  Server Type: ${CYAN}Paper/Spigot (Multi-world)${NC}"
else
    echo -e "  Server Type: ${CYAN}Vanilla/Single-world${NC}"
fi
[ "$INSTANCE_NAME" != "default" ] && echo -e "  Instance: ${CYAN}$INSTANCE_NAME${NC}"
```

**Benefits:**
- Clear server type identification
- Shows instance name if not default
- Better user awareness of configuration

---

## Installation Flow (Updated)

### New User Experience:

```
[2/8] Backup Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Auto-detected world path: /var/lib/pterodactyl/volumes/{uuid}/world
✓ Detected Paper-based multi-world setup:
  ✓ /var/lib/pterodactyl/volumes/{uuid}/world
  ✓ /var/lib/pterodactyl/volumes/{uuid}/world_nether
  ✓ /var/lib/pterodactyl/volumes/{uuid}/world_the_end

Note: All three world folders will be backed up

Is this correct? (Y/n): y

Where should local backups be stored? [/backups/minecraft-smp]: 
> /backups/minecraft-smp

How many days should local backups be retained? [10]: 
> 5

Select backup schedule:
1) Daily at midnight (00:00)
2) Twice daily (00:00, 12:00)
3) Three times daily (00:00, 12:00, 18:00)
4) Every 6 hours (00:00, 06:00, 12:00, 18:00)
5) Custom cron expression
> 2

Server Setup Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ Multi-world detected: Paper/Spigot server with separate dimension folders

Do you have multiple Minecraft servers on this VPS?
If yes, you can create additional instances later using:
  sudo /opt/mc-backup/scripts/create-instance.sh <name>

Is this your first/only server? (Y/n): y
ℹ This will be your primary backup instance

[3/8] Offsite Backup Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
```

---

## Testing Results

### ✅ JSON Generation Test
```bash
# Input: "Admin,Moderator"
# Output: ["Admin","Moderator"]  ✓ Valid

# Input: "Admin"  
# Output: ["Admin"]  ✓ Valid

# Input: "Owner,Admin,Mod"
# Output: ["Owner","Admin","Mod"]  ✓ Valid
```

### ✅ Multi-World Detection
```bash
# Paper server with world/world_nether/world_the_end
→ Detects multi-world ✓
→ Shows all 3 paths ✓
→ Informs user all will be backed up ✓

# Vanilla server with single world/
→ Detects single-world ✓
→ Shows single path ✓
```

### ✅ Multi-Server Prompt
```bash
# First server on VPS
→ Asks if first/only ✓
→ Sets instance to "default" ✓

# Additional server
→ Prompts for instance name ✓
→ Shows create-instance.sh command ✓
→ Warns about schedule staggering ✓
```

---

## Deployment Status

✅ **Fixed**: JSON array generation bug  
✅ **Added**: Multi-world detection prompts  
✅ **Added**: Multi-server instance prompts  
✅ **Added**: Enhanced review screen  
✅ **Committed**: `c271882`  
✅ **Pushed**: GitHub master branch  

---

## User Impact

### Before Fixes:
- ❌ Installation failed with JSON parse error
- ❌ No awareness of multi-world support
- ❌ No guidance on multi-server setups
- ❌ Manual config editing required

### After Fixes:
- ✅ Clean installation with valid JSON
- ✅ Clear multi-world detection and messaging
- ✅ Guided multi-server instance setup
- ✅ No manual editing needed

---

## Additional Fix Applied

### Production Config Repair
```bash
# Your broken config at /etc/mc-backup/config.json
# Fixed with:
sudo sed -i 's/"allowed_roles_backup": "Admin"],/"allowed_roles_backup": ["Admin"],/' /etc/mc-backup/config.json

# Service restarted successfully
sudo systemctl restart mc-backup
# Status: ✅ Active (running)
```

---

## Next Steps for You

### 1. Test the Manual Backup
```bash
sudo -u mc-backup node /opt/mc-backup/scripts/manual-backup.js
```

### 2. Check Service Logs
```bash
sudo journalctl -u mc-backup -f
```

### 3. Test Discord Bot
```
In your Discord server:
/backup status
/backup now
```

### 4. Verify Multi-World Detection
Check logs for:
```
Multi-world structure detected (Paper-based)
  overworld: /var/lib/pterodactyl/.../world
  nether: /var/lib/pterodactyl/.../world_nether  
  end: /var/lib/pterodactyl/.../world_the_end
```

---

## Version History

- **v1.1.0**: Multi-world and multi-server support (2025-11-07)
- **v1.1.1**: Bug fixes for installer (2025-11-07) ← **Current**

---

**Status**: ✅ All Fixes Applied and Deployed  
**Commit**: `c271882`  
**Your System**: ✅ Config Fixed, Service Running
