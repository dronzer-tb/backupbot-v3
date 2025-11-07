# GitHub Setup Guide

This guide will help you push your Minecraft Backup System to GitHub as a new repository named "backupbot-v3".

## Quick Setup (Recommended)

Run these commands in your terminal:

```bash
cd "/home/kasniya/backupbot v3"

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Minecraft Backup System v3"

# Create GitHub repository (using GitHub CLI - install if needed)
gh repo create backupbot-v3 --public --source=. --remote=origin --push

# Or manually push to existing repository
# git remote add origin https://github.com/dronzer-tb/backupbot-v3.git
# git branch -M main
# git push -u origin main
```

## Manual Setup (Step-by-Step)

### 1. Initialize Local Git Repository

```bash
cd "/home/kasniya/backupbot v3"
git init
git add .
git commit -m "Initial commit: Minecraft Backup System v3"
```

### 2. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: **backupbot-v3**
3. Description: **Automated Minecraft SMP backup system with Discord integration, Pterodactyl API support, and offsite backups**
4. Choose **Public** or **Private**
5. **Do NOT** initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

### 3. Push to GitHub

GitHub will show you commands. Use these:

```bash
git remote add origin https://github.com/dronzer-tb/backupbot-v3.git
git branch -M main
git push -u origin main
```

Replace `dronzer-tb` with your actual GitHub username.

### 4. Verify Installation Script URL

After pushing, your installation script will be available at:

```
https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/main/install.sh
```

Test it works:

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/main/install.sh
```

## One-Line Installation Command

Once pushed to GitHub, users can install with:

```bash
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/main/install.sh | sudo bash
```

## Update README

Update the installation section in `README.md` to include your actual GitHub username:

```bash
sed -i 's/dronzer-tb/your-actual-username/g' README.md
sed -i 's/dronzer-tb/your-actual-username/g' install.sh
git add README.md install.sh
git commit -m "Update GitHub username in documentation"
git push
```

## Recommended Repository Settings

### Topics/Tags

Add these topics to your repository for better discoverability:

- minecraft
- backup
- automation
- discord-bot
- pterodactyl
- nodejs
- rsync
- server-management

### Repository Description

```
🎮 Automated Minecraft SMP backup system with zero-downtime backups, Discord bot control, Pterodactyl Panel integration, and optional offsite storage via rclone
```

### GitHub Pages (Optional)

You can enable GitHub Pages to host documentation:

1. Go to repository **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** → **/ (root)**
4. Click **Save**

Your docs will be available at: `https://dronzer-tb.github.io/backupbot-v3/`

## .gitignore

We should create a `.gitignore` file to avoid committing sensitive data:

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Configuration (contains secrets)
config/config.json

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Backups (too large)
backups/
*.tar.gz
*.zip

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Environment
.env
.env.local

# Test files
test-output/

# Temporary files
tmp/
temp/
.cache/
EOF

git add .gitignore
git commit -m "Add .gitignore for sensitive and generated files"
```

## GitHub CLI Installation (Optional)

If you want to use `gh` command for easier repository creation:

```bash
# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Authenticate
gh auth login
```

## Security Notes

⚠️ **Important:**

1. **Never commit** `config/config.json` - it contains API keys and bot tokens
2. The `.gitignore` file is already set up to exclude it
3. Only `config/config.example.json` should be in the repository
4. If you accidentally commit secrets, use `git filter-branch` or BFG Repo-Cleaner to remove them

## Create GitHub Release (After Testing)

Once you've tested the system:

```bash
# Tag the release
git tag -a v1.0.0 -m "Release v1.0.0: Initial stable release"
git push origin v1.0.0

# Or use GitHub CLI
gh release create v1.0.0 --title "v1.0.0 - Initial Release" --notes "First stable release of Minecraft Backup System"
```

## Complete Checklist

- [ ] Initialize git repository
- [ ] Create `.gitignore` file
- [ ] Create GitHub repository "backupbot-v3"
- [ ] Push code to GitHub
- [ ] Update dronzer-tb in README.md and install.sh
- [ ] Add repository description and topics
- [ ] Test installation script URL
- [ ] Create v1.0.0 release tag
- [ ] (Optional) Enable GitHub Pages
- [ ] (Optional) Add repository badges to README

## Example Repository Badges

Add these to the top of your README.md:

```markdown
![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-linux-lightgrey)
[![GitHub Stars](https://img.shields.io/github/stars/dronzer-tb/backupbot-v3)](https://github.com/dronzer-tb/backupbot-v3/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/dronzer-tb/backupbot-v3)](https://github.com/dronzer-tb/backupbot-v3/issues)
```

---

## Quick Reference Commands

```bash
# Clone your repository later
git clone https://github.com/dronzer-tb/backupbot-v3.git

# Install on a server
curl -fsSL https://raw.githubusercontent.com/dronzer-tb/backupbot-v3/main/install.sh | sudo bash

# Update local changes
git add .
git commit -m "Your commit message"
git push

# Pull updates on server
cd /opt/mc-backup
git pull origin main
npm install
sudo systemctl restart mc-backup
```

Happy coding! 🚀
