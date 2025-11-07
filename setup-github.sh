#!/bin/bash
###############################################################################
# GitHub Setup Script for Minecraft Backup System
# 
# This script helps you push the project to GitHub
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

clear
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}   ${BOLD}GitHub Repository Setup - backupbot-v3${NC}                  ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Git is not installed. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y git
fi

# Get GitHub username
echo -e "${BOLD}Enter your GitHub username:${NC}"
echo -n "> "
read GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${YELLOW}Error: GitHub username is required${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Setting up repository as: ${CYAN}https://github.com/${GITHUB_USERNAME}/backupbot-v3${NC}"
echo ""

# Update placeholders in files
echo -e "${BOLD}[1/6]${NC} Updating GitHub username in files..."
sed -i "s/YOUR_USERNAME/${GITHUB_USERNAME}/g" README.md
sed -i "s/YOUR_USERNAME/${GITHUB_USERNAME}/g" install.sh
sed -i "s/YOUR_USERNAME/${GITHUB_USERNAME}/g" GITHUB_SETUP.md
echo -e "${GREEN}✓${NC} Updated"

# Initialize git repository
echo -e "${BOLD}[2/6]${NC} Initializing git repository..."
if [ ! -d ".git" ]; then
    git init
    echo -e "${GREEN}✓${NC} Initialized"
else
    echo -e "${GREEN}✓${NC} Already initialized"
fi

# Configure git (if not already configured)
if ! git config user.name &> /dev/null; then
    echo ""
    echo -e "${BOLD}Git is not configured. Let's set it up:${NC}"
    echo -e "Enter your name (for commits):"
    echo -n "> "
    read GIT_NAME
    
    echo -e "Enter your email (for commits):"
    echo -n "> "
    read GIT_EMAIL
    
    git config user.name "$GIT_NAME"
    git config user.email "$GIT_EMAIL"
    echo -e "${GREEN}✓${NC} Git configured"
fi

# Add all files
echo -e "${BOLD}[3/6]${NC} Adding files to git..."
git add .
echo -e "${GREEN}✓${NC} Files added"

# Create initial commit
echo -e "${BOLD}[4/6]${NC} Creating initial commit..."
if git rev-parse HEAD &> /dev/null; then
    git commit -m "Update GitHub username to ${GITHUB_USERNAME}" || echo "No changes to commit"
else
    git commit -m "Initial commit: Minecraft Backup System v3

Features:
- Zero-downtime backups using Pterodactyl API
- Discord bot with 9 management commands
- Incremental backups with rsync --link-dest
- Optional offsite backups via rclone
- Automated installation script
- Comprehensive audit logging
- Storage monitoring and cleanup
- Restore with verification and rollback"
fi
echo -e "${GREEN}✓${NC} Committed"

# Check for GitHub CLI
echo ""
if command -v gh &> /dev/null; then
    echo -e "${BOLD}[5/6]${NC} GitHub CLI detected!"
    echo -e "${BLUE}Would you like to create the repository automatically? (y/n)${NC}"
    echo -n "> "
    read USE_GH_CLI
    
    if [ "$USE_GH_CLI" = "y" ] || [ "$USE_GH_CLI" = "Y" ]; then
        echo ""
        echo -e "${BLUE}Creating repository on GitHub...${NC}"
        
        gh repo create backupbot-v3 \
            --public \
            --source=. \
            --remote=origin \
            --description="🎮 Automated Minecraft SMP backup system with zero-downtime backups, Discord bot control, Pterodactyl Panel integration, and optional offsite storage via rclone" \
            --push
        
        echo -e "${GREEN}✓${NC} Repository created and pushed!"
        
        # Add topics
        echo ""
        echo -e "${BOLD}Adding repository topics...${NC}"
        gh repo edit --add-topic minecraft,backup,automation,discord-bot,pterodactyl,nodejs,rsync,server-management
        echo -e "${GREEN}✓${NC} Topics added"
        
        REPO_URL="https://github.com/${GITHUB_USERNAME}/backupbot-v3"
        INSTALL_URL="https://raw.githubusercontent.com/${GITHUB_USERNAME}/backupbot-v3/main/install.sh"
        
        echo ""
        echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}${BOLD}✓ Setup Complete!${NC}"
        echo ""
        echo -e "${BOLD}Your repository:${NC}"
        echo -e "  ${CYAN}${REPO_URL}${NC}"
        echo ""
        echo -e "${BOLD}Installation command:${NC}"
        echo -e "  ${CYAN}curl -fsSL ${INSTALL_URL} | sudo bash${NC}"
        echo ""
        echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
        
        exit 0
    fi
fi

# Manual setup instructions
echo -e "${BOLD}[5/6]${NC} Manual repository creation needed"
echo ""
echo -e "${YELLOW}GitHub CLI not available or skipped. Follow these steps:${NC}"
echo ""
echo -e "${BOLD}1. Create repository on GitHub:${NC}"
echo -e "   • Go to: ${CYAN}https://github.com/new${NC}"
echo -e "   • Repository name: ${CYAN}backupbot-v3${NC}"
echo -e "   • Description: ${CYAN}Automated Minecraft backup system with Discord bot${NC}"
echo -e "   • Choose Public or Private"
echo -e "   • ${YELLOW}Do NOT${NC} initialize with README"
echo -e "   • Click 'Create repository'"
echo ""
echo -e "${BOLD}2. Push to GitHub:${NC}"
echo ""
echo -e "   ${CYAN}git remote add origin https://github.com/${GITHUB_USERNAME}/backupbot-v3.git${NC}"
echo -e "   ${CYAN}git branch -M main${NC}"
echo -e "   ${CYAN}git push -u origin main${NC}"
echo ""
echo -e "${BOLD}Or run these commands now:${NC}"
echo ""

# Offer to set up remote
echo -e "${BLUE}Set up remote now? (y/n)${NC}"
echo -n "> "
read SETUP_REMOTE

if [ "$SETUP_REMOTE" = "y" ] || [ "$SETUP_REMOTE" = "Y" ]; then
    echo ""
    git remote add origin "https://github.com/${GITHUB_USERNAME}/backupbot-v3.git" 2>/dev/null || git remote set-url origin "https://github.com/${GITHUB_USERNAME}/backupbot-v3.git"
    git branch -M main
    
    echo -e "${GREEN}✓${NC} Remote configured"
    echo ""
    echo -e "${YELLOW}Now create the repository on GitHub, then run:${NC}"
    echo -e "   ${CYAN}git push -u origin main${NC}"
fi

echo -e "${BOLD}[6/6]${NC} Setup prepared!"
echo ""
echo -e "${BOLD}After pushing, your installation URL will be:${NC}"
echo -e "  ${CYAN}https://raw.githubusercontent.com/${GITHUB_USERNAME}/backupbot-v3/main/install.sh${NC}"
echo ""
echo -e "${BOLD}Installation command for users:${NC}"
echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/${GITHUB_USERNAME}/backupbot-v3/main/install.sh | sudo bash${NC}"
echo ""

echo -e "${GREEN}Setup script complete!${NC}"
