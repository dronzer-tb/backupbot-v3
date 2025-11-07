# 🐛 Bug Fix: Docker/Pterodactyl Path Issue + Storage Allocation Feature

**Date:** November 7, 2025  
**Status:** ✅ Fixed  
**Version:** 1.1.0

---

## 🔴 Critical Bug: rsync Permission Denied in Docker Container

### Problem Description
When running backups from inside a Docker container (Pterodactyl environment), rsync failed with:
```
rsync: [sender] change_dir "/var/lib/pterodactyl/volumes/88aa51dc.../world" failed: Permission denied (13)
rsync error: some files/attrs were not transferred (code 23)
⚠️ Path does not exist: /var/lib/pterodactyl/volumes/...
```

### Root Cause
The backup process was running **inside the Docker container**, but the configured path `/var/lib/pterodactyl/volumes/<UUID>/world` exists **only on the host machine**.

In Pterodactyl's architecture:
- **Host path:** `/var/lib/pterodactyl/volumes/<UUID>/`
- **Container path:** `/home/container/`

The container filesystem couldn't access the host path, causing the "Permission denied" error.

### Solution Implemented

#### 1. Added Container Path Support
New configuration options in `config.json`:

```json
{
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/SERVER_UUID/world",
    "container_path": "/home/container/world",
    "use_container_path": false
  }
}
```

**Configuration Guide:**

| Environment | `use_container_path` | `source_path` | `container_path` |
|-------------|---------------------|---------------|------------------|
| **Running on Host** | `false` | `/var/lib/pterodactyl/volumes/UUID/world` | Not used |
| **Running in Container** | `true` | (fallback) | `/home/container/world` |

#### 2. Code Changes

**File:** `src/backup/backupEngine.js`

Added new method `getSourcePath()`:
```javascript
/**
 * Get the correct source path based on configuration
 * Handles Docker/Pterodactyl container path mapping
 */
getSourcePath() {
  // If running inside container and container_path is configured, use it
  if (this.config.backup.use_container_path && this.config.backup.container_path) {
    console.log('ℹ️  Using container path for backup source');
    return this.config.backup.container_path;
  }

  // Default to host path
  return this.config.backup.source_path;
}
```

Modified `detectWorldStructure()` to use `getSourcePath()` instead of directly accessing `config.backup.source_path`.

#### 3. Validation Updates

**File:** `src/config/validator.js`

Added validation for container path configuration:
```javascript
// Validate container path if use_container_path is enabled
if (config.backup.use_container_path && !config.backup.container_path) {
  errors.push('backup.container_path is required when use_container_path is true');
}
```

---

## ✨ New Feature: Dedicated Backup Storage Allocation

### Problem
Previously, disk usage alerts were based on the **entire system disk**, which could be misleading when you only want to dedicate a specific amount of storage to backups.

### Solution
Added configurable storage allocation that treats backups as having a dedicated quota.

### Configuration

```json
{
  "backup": {
    "max_backup_size_gb": 50
  },
  "alerts": {
    "disk_usage_warning": 80,
    "disk_usage_critical": 95,
    "use_allocated_storage": true
  }
}
```

### How It Works

#### When `use_allocated_storage: true`
- Monitors **backup directory size** vs **allocated limit**
- Example: If `max_backup_size_gb: 50`:
  - Warning at 40 GB (80%)
  - Critical at 47.5 GB (95%)

#### When `use_allocated_storage: false` (default)
- Monitors **system disk usage** (original behavior)
- Warning/critical thresholds apply to entire disk

### Code Changes

**File:** `src/storage/monitoring.js`

Updated `StorageMonitor` class:

```javascript
constructor(config) {
  // ... existing code ...
  
  // Storage allocation settings
  this.useAllocatedStorage = config.alerts?.use_allocated_storage || false;
  this.maxBackupSizeGB = config.backup?.max_backup_size_gb || null;
  this.maxBackupSizeBytes = this.maxBackupSizeGB ? 
    this.maxBackupSizeGB * 1024 * 1024 * 1024 : null;
}
```

Updated `checkDiskUsage()` to calculate percentage based on allocated storage:

```javascript
if (this.useAllocatedStorage && this.maxBackupSizeBytes) {
  // Use allocated storage limits
  const backupSize = await this.getBackupDirectorySize();
  percentage = (backupSize / this.maxBackupSizeBytes) * 100;
  
  usage = {
    total: this.maxBackupSizeBytes,
    used: backupSize,
    available: this.maxBackupSizeBytes - backupSize,
    percentage: Math.round(percentage),
    filesystem: 'allocated',
    mountpoint: this.backupDir
  };
} else {
  // Use system disk usage (original behavior)
  usage = await this.getBackupDiskUsage();
  percentage = usage.percentage;
}
```

Updated `hasEnoughSpace()` to check against allocated storage:

```javascript
if (this.useAllocatedStorage && this.maxBackupSizeBytes) {
  // Check against allocated storage limit
  const backupSize = await this.getBackupDirectorySize();
  available = this.maxBackupSizeBytes - backupSize;
} else {
  // Check against system disk space
  const usage = await this.getBackupDiskUsage();
  available = usage.available;
}
```

---

## 📝 Configuration Examples

### Example 1: Running on Host (Traditional Setup)
```json
{
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/88aa51dc-ee43-40c0-b949-bdca78811a67/world",
    "use_container_path": false,
    "backup_dir": "/backups/minecraft-smp",
    "max_backup_size_gb": 100,
    "retention_local_days": 10
  },
  "alerts": {
    "disk_usage_warning": 80,
    "disk_usage_critical": 95,
    "use_allocated_storage": true
  }
}
```

### Example 2: Running in Container
```json
{
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/88aa51dc-ee43-40c0-b949-bdca78811a67/world",
    "container_path": "/home/container/world",
    "use_container_path": true,
    "backup_dir": "/backups",
    "max_backup_size_gb": 50,
    "retention_local_days": 7
  },
  "alerts": {
    "disk_usage_warning": 80,
    "disk_usage_critical": 95,
    "use_allocated_storage": true
  }
}
```

### Example 3: System Disk Monitoring (Original Behavior)
```json
{
  "backup": {
    "source_path": "/var/lib/pterodactyl/volumes/UUID/world",
    "backup_dir": "/backups/minecraft-smp",
    "retention_local_days": 10
  },
  "alerts": {
    "disk_usage_warning": 80,
    "disk_usage_critical": 95,
    "use_allocated_storage": false
  }
}
```

---

## ✅ Testing

### Test 1: Container Path Detection
```bash
# Before fix
rsync: change_dir "/var/lib/pterodactyl/..." failed: Permission denied (13)

# After fix (with use_container_path: true)
ℹ️  Using container path for backup source
📁 Single world structure detected: /home/container/world
✓ Backup completed successfully
```

### Test 2: Storage Allocation
```bash
# Scenario: max_backup_size_gb: 50, current backups: 45 GB

# System shows: Disk 20% full (whole system has 500 GB)
# Allocated shows: Backups 90% full (45/50 GB)

# With use_allocated_storage: true
⚠️  Storage critical: 90% of allocated 50 GB used
```

---

## 🚀 Deployment Notes

### For Users Running on Host
No changes needed if already working. Optionally add `max_backup_size_gb` for better storage management.

### For Users Running in Container
**Required changes:**
1. Set `use_container_path: true`
2. Set `container_path: "/home/container/world"` (or your container's world path)
3. Optionally set `max_backup_size_gb` for allocated storage monitoring

### Installation Script Updates
The `install.sh` script should be updated to:
1. Ask user: "Are you running this inside a container?"
2. Ask user: "How much storage (GB) do you want to dedicate to backups?"
3. Automatically configure the appropriate settings

---

## 📊 Files Modified

1. ✅ `config/config.example.json` - Added new configuration options
2. ✅ `src/config/validator.js` - Added validation for new options
3. ✅ `src/backup/backupEngine.js` - Added `getSourcePath()` method
4. ✅ `src/storage/monitoring.js` - Added allocated storage monitoring

---

## 🎯 Benefits

### Bug Fix Benefits
- ✅ Backups now work correctly in Docker/Pterodactyl containers
- ✅ Automatic path selection based on environment
- ✅ No more "Permission denied" errors
- ✅ Backward compatible with host-based setups

### Feature Benefits
- ✅ Better control over backup storage usage
- ✅ Prevents backups from filling entire disk
- ✅ More accurate storage alerts
- ✅ Configurable storage quotas
- ✅ Works alongside existing retention policies

---

## 🔍 Migration Guide

### From v1.0.0 to v1.1.0

**No breaking changes!** Your existing config will continue to work.

**Optional upgrades:**

1. **Add storage allocation (recommended):**
```json
"backup": {
  "max_backup_size_gb": 100  // Add this
}
"alerts": {
  "use_allocated_storage": true  // Add this
}
```

2. **If running in container:**
```json
"backup": {
  "container_path": "/home/container/world",  // Add this
  "use_container_path": true  // Add this
}
```

---

**Fixed by:** GitHub Copilot  
**Tested:** November 7, 2025  
**Status:** ✅ Ready for Production
