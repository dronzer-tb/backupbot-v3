#!/bin/bash
###############################################################################
# Repository Update Script
# Commits and pushes only modified files to GitHub
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
echo -e "${CYAN}║${NC}   ${BOLD}Repository Update - Push Changes to GitHub${NC}             ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Error: Not a git repository${NC}"
    echo -e "${BLUE}Run ./setup-github.sh first to initialize the repository${NC}"
    exit 1
fi

# Check for changes
echo -e "${BOLD}Checking for changes...${NC}"
echo ""

# Get status
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${GREEN}✓${NC} Found uncommitted changes"
else
    if [ -z "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}No changes to commit${NC}"
        echo ""
        echo -e "${BLUE}Checking if local is ahead of remote...${NC}"
        
        # Check if we need to push
        LOCAL=$(git rev-parse @ 2>/dev/null || echo "")
        REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
        
        if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
            echo -e "${GREEN}✓${NC} Local commits found that need to be pushed"
            
            echo ""
            echo -e "${BOLD}Pushing to remote...${NC}"
            git push
            
            echo ""
            echo -e "${GREEN}${BOLD}✓ Successfully pushed to GitHub!${NC}"
            exit 0
        else
            echo -e "${GREEN}✓${NC} Everything up to date"
            exit 0
        fi
    fi
fi

# Show what will be committed
echo -e "${BOLD}Modified files:${NC}"
git status --short
echo ""

# Ask for commit message
echo -e "${BOLD}Enter commit message:${NC}"
echo -e "${CYAN}(or press Enter for default: 'Update files')${NC}"
echo -n "> "
read COMMIT_MESSAGE

if [ -z "$COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="Update files"
fi

# Add all changes
echo ""
echo -e "${BOLD}Staging changes...${NC}"
git add -A
echo -e "${GREEN}✓${NC} Changes staged"

# Create commit
echo ""
echo -e "${BOLD}Creating commit...${NC}"
git commit -m "$COMMIT_MESSAGE"
echo -e "${GREEN}✓${NC} Commit created"

# Push to remote
echo ""
echo -e "${BOLD}Pushing to GitHub...${NC}"

# Check if remote exists
if ! git remote get-url origin &>/dev/null; then
    echo -e "${YELLOW}No remote configured${NC}"
    echo ""
    echo -e "${BOLD}Enter your GitHub username:${NC}"
    echo -n "> "
    read GITHUB_USERNAME
    
    git remote add origin "https://github.com/${GITHUB_USERNAME}/backupbot-v3.git"
    echo -e "${GREEN}✓${NC} Remote added"
fi

# Push to master branch
if ! git push origin master 2>&1; then
    echo ""
    echo -e "${YELLOW}Push failed - remote has changes we don't have locally${NC}"
    echo -e "${BOLD}Attempting to pull and rebase...${NC}"
    
    # Pull with rebase
    if git pull origin master --rebase; then
        echo -e "${GREEN}✓${NC} Rebase successful"
        
        # Try push again
        echo -e "${BOLD}Pushing again...${NC}"
        git push origin master
    else
        echo ""
        echo -e "${YELLOW}Rebase had conflicts - please resolve manually:${NC}"
        echo -e "  1. Fix conflicts in the listed files"
        echo -e "  2. Run: ${CYAN}git add <fixed-files>${NC}"
        echo -e "  3. Run: ${CYAN}git rebase --continue${NC}"
        echo -e "  4. Run: ${CYAN}git push origin master${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}✓ Update Complete!${NC}"
echo ""
echo -e "${BOLD}Changes pushed to:${NC}"

# Get remote URL
REMOTE_URL=$(git remote get-url origin)
REPO_URL=$(echo "$REMOTE_URL" | sed 's/\.git$//' | sed 's/git@github.com:/https:\/\/github.com\//')

echo -e "  ${CYAN}${REPO_URL}${NC}"
echo ""

# Get GitHub username from URL
GITHUB_USER=$(echo "$REPO_URL" | sed 's/.*github\.com\///' | cut -d'/' -f1)

echo -e "${BOLD}Installation URL:${NC}"
echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/${GITHUB_USER}/backupbot-v3/master/install.sh | sudo bash${NC}"
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

# Show commit details
echo ""
echo -e "${BOLD}Latest commit:${NC}"
git log -1 --pretty=format:"%h - %s (%an, %ar)" --color=always
echo ""
echo ""

# Ask about viewing on GitHub
echo -e "${BLUE}View on GitHub? (y/n):${NC}"
echo -n "> "
read VIEW_GITHUB

if [ "$VIEW_GITHUB" = "y" ] || [ "$VIEW_GITHUB" = "Y" ]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open "$REPO_URL"
    elif command -v open &> /dev/null; then
        open "$REPO_URL"
    else
        echo -e "${CYAN}Open in browser: ${REPO_URL}${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"
