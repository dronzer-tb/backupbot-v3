#!/bin/bash
###############################################################################
# Quick Deploy Script - Push to GitHub and Get Installation URL
###############################################################################

echo "╔════════════════════════════════════════════════════════════╗"
echo "║        Quick Deploy - Minecraft Backup System v3          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "This will help you deploy to GitHub in 3 simple steps:"
echo ""
echo "1️⃣  Run setup script"
echo "2️⃣  Create GitHub repository"
echo "3️⃣  Get installation URL"
echo ""
echo "Press Enter to start, or Ctrl+C to cancel..."
read

# Run setup script
./setup-github.sh

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ All done! Your repository is ready."
echo ""
echo "📚 Read GITHUB_SETUP.md for detailed instructions"
echo "📝 Read INSTALL_SCRIPT_COMPLETE.md for installer docs"
echo ""
echo "🚀 Happy deploying!"
echo "════════════════════════════════════════════════════════════"
