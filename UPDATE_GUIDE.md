# 🔄 Update Repository Script - Quick Guide

## What's New

### ✅ Created: `update-repo.sh`

A smart update script that:
- ✅ Detects changed files automatically
- ✅ Asks for commit message (or uses default)
- ✅ Commits and pushes only modified files
- ✅ Shows installation URL after push
- ✅ Uses **master** branch (not main)

### ✅ Fixed: Branch Name References

Updated all documentation to use **master** branch instead of main:
- ✅ README.md
- ✅ install.sh
- ✅ GITHUB_SETUP.md
- ✅ INSTALL_SCRIPT_COMPLETE.md
- ✅ INSTALLER_FIXES.md
- ✅ setup-github.sh

---

## 📝 Usage

### Quick Update (Recommended)

```bash
./update-repo.sh
```

This will:
1. Check for modified files
2. Ask for commit message
3. Stage all changes
4. Commit with your message
5. Push to GitHub (master branch)
6. Show your installation URL

---

## 🎯 Common Workflows

### 1. Push Recent Changes

```bash
./update-repo.sh
# Enter commit message when prompted
# Example: "Fixed ConfigManager import issue"
```

### 2. Quick Push (Default Message)

```bash
./update-repo.sh
# Just press Enter to use "Update files"
```

### 3. Check What Changed

```bash
git status
# or
git diff
```

### 4. View Commit History

```bash
git log --oneline -10
```

---

## 📋 What Gets Updated

The script automatically detects changes in:
- ✅ Source code files (*.js)
- ✅ Configuration files (*.json)
- ✅ Documentation (*.md)
- ✅ Scripts (*.sh)
- ✅ Any other modified files

**Excluded** (via .gitignore):
- ❌ node_modules/
- ❌ config/config.json (secrets)
- ❌ logs/
- ❌ backups/

---

## 🔗 Installation URL

After pushing, users can install with:

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | sudo bash
```

**Note**: Uses **master** branch (not main)

---

## 🛠️ Manual Git Commands (Advanced)

If you prefer manual control:

```bash
# See what changed
git status

# Add specific files
git add src/index.js scripts/manual-backup.js

# Or add all changes
git add -A

# Commit
git commit -m "Your message here"

# Push to master
git push origin master
```

---

## 🔍 Troubleshooting

### "Not a git repository"

**Solution**: Run `./setup-github.sh` first to initialize

### "No remote configured"

**Solution**: Script will ask for your GitHub username and set it up

### "No changes to commit"

**Solution**: Everything is up to date! No action needed.

### "Permission denied"

**Solution**: Make script executable:
```bash
chmod +x update-repo.sh
```

---

## 📊 Comparison: setup-github.sh vs update-repo.sh

| Feature | setup-github.sh | update-repo.sh |
|---------|----------------|----------------|
| **Purpose** | Initial setup | Push updates |
| **When to use** | First time only | Every update |
| **What it does** | Creates repo, first push | Commits & pushes changes |
| **Updates username** | ✅ Yes | ❌ No (already set) |
| **Creates repo** | ✅ Yes (with gh CLI) | ❌ No (assumes exists) |
| **Speed** | Slower (full setup) | Fast (just push) |

---

## ✨ Example Session

```bash
$ ./update-repo.sh

╔════════════════════════════════════════════════════════════╗
║   Repository Update - Push Changes to GitHub             ║
╚════════════════════════════════════════════════════════════╝

Checking for changes...

✓ Found uncommitted changes

Modified files:
M  src/index.js
M  scripts/manual-backup.js
M  install.sh

Enter commit message:
(or press Enter for default: 'Update files')
> Fixed ConfigManager import and permissions

Staging changes...
✓ Changes staged

Creating commit...
✓ Commit created

Pushing to GitHub...
✓ Update Complete!

Changes pushed to:
  https://github.com/dronzer-tb/backupbot-v3

Installation URL:
  curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/master/install.sh | sudo bash

Latest commit:
a1b2c3d - Fixed ConfigManager import and permissions (dronzer-tb, 1 minute ago)

Done!
```

---

## 🎯 Best Practices

1. **Commit Often**: Make small, focused commits
2. **Descriptive Messages**: Use clear commit messages
3. **Test First**: Test changes locally before pushing
4. **Check Status**: Run `git status` to see what changed
5. **Pull First**: If working with others, pull before push

---

## 📝 Quick Reference

```bash
# Push updates
./update-repo.sh

# First time setup
./setup-github.sh

# Check changes
git status

# View history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all changes (CAREFUL!)
git reset --hard HEAD
```

---

**Ready to push your updates!** 🚀

Run: `./update-repo.sh`
