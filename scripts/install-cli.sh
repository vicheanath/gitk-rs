#!/bin/bash

# GitK-RS Installation Setup
# This script helps install GitK-RS CLI to system PATH

set -e

echo "🚀 Setting up GitK-RS CLI..."

# Determine target directory
INSTALL_DIR="${1:-/usr/local/bin}"

# Check if gitkrs script exists
if [ ! -f "scripts/gitkrs" ]; then
    echo "Error: scripts/gitkrs not found"
    echo "Please run this script from the GitK-RS project root directory"
    exit 1
fi

# Make the script executable
chmod +x scripts/gitkrs

# Create symbolic link or copy to PATH
if [ -w "$INSTALL_DIR" ]; then
    # Copy to PATH
    cp scripts/gitkrs "$INSTALL_DIR/gitkrs"
    echo "✅ GitK-RS CLI installed to $INSTALL_DIR/gitkrs"
else
    # Try with sudo
    echo "ℹ️  Installing to $INSTALL_DIR requires elevated permissions"
    sudo cp scripts/gitkrs "$INSTALL_DIR/gitkrs"
    echo "✅ GitK-RS CLI installed to $INSTALL_DIR/gitkrs (using sudo)"
fi

# Make it executable
chmod +x "$INSTALL_DIR/gitkrs"

echo ""
echo "📝 Usage:"
echo "  gitkrs          - Opens current directory if it's a git repo"
echo "  gitkrs /path/to/repo - Opens the specified git repository"
echo ""
echo "🎉 Setup complete! You can now use 'gitkrs' from any git repository."
