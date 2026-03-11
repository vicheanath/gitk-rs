#!/bin/bash

# GitK-RS Post-Install Setup Script (macOS)
# This script is typically run after installing the app
# It sets up the 'gitr' CLI command

set -e

echo "🚀 GitK-RS Post-Install Setup"
echo ""
echo "This script will set up the 'gitr' command for your system."
echo ""

# Find the gitr script in the app bundle
APP_PATH="/Applications/gitk-rs.app"
SCRIPT_PATH="$APP_PATH/Contents/Resources/scripts/gitr"

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Error: Cannot find gitr script in app bundle"
    echo "   Expected location: $SCRIPT_PATH"
    exit 1
fi

INSTALL_DIR="${1:-/usr/local/bin}"

echo "📍 Installation path: $INSTALL_DIR"
echo ""

# Make script executable
chmod +x "$SCRIPT_PATH"

# Install to PATH
if [ -w "$INSTALL_DIR" ]; then
    cp "$SCRIPT_PATH" "$INSTALL_DIR/gitr"
    chmod +x "$INSTALL_DIR/gitr"
    echo "✅ Gitr CLI installed successfully!"
else
    echo "⚠️  Installing to $INSTALL_DIR requires elevated permissions"
    sudo cp "$SCRIPT_PATH" "$INSTALL_DIR/gitr"
    sudo chmod +x "$INSTALL_DIR/gitr"
    echo "✅ Gitr CLI installed successfully! (with sudo)"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "You can now use 'gitr' from any directory:"
echo "  cd /path/to/repo"
echo "  gitr"
echo ""
echo "💡 Tip: Add an alias for faster access:"
echo "  alias gr='gitr'  # (add to ~/.zshrc or ~/.bashrc)"
