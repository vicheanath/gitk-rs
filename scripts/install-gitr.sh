#!/bin/bash

# Gitr - GitK-RS CLI installation script
# Works on macOS, Linux, and Windows (Git Bash/MSYS2)
# Installs the 'gitr' command to system PATH

set -e

echo "🚀 Setting up Gitr CLI..."

# Detect OS
OS_TYPE=$(uname -s)

case "$OS_TYPE" in
    Darwin)
        # macOS
        echo "📱 Detected macOS"
        INSTALL_DIR="${1:-/usr/local/bin}"
        
        if [ ! -f "scripts/gitr" ]; then
            echo "❌ Error: scripts/gitr not found"
            echo "Please run this script from the GitK-RS project root directory"
            exit 1
        fi
        
        chmod +x scripts/gitr
        
        if [ -w "$INSTALL_DIR" ]; then
            cp scripts/gitr "$INSTALL_DIR/gitr"
            echo "✅ Gitr CLI installed to $INSTALL_DIR/gitr"
        else
            echo "ℹ️  Installing to $INSTALL_DIR requires elevated permissions"
            sudo cp scripts/gitr "$INSTALL_DIR/gitr"
            echo "✅ Gitr CLI installed to $INSTALL_DIR/gitr (using sudo)"
        fi
        
        chmod +x "$INSTALL_DIR/gitr"
        ;;
        
    Linux)
        # Linux
        echo "🐧 Detected Linux"
        INSTALL_DIR="${1:-/usr/local/bin}"
        
        if [ ! -f "scripts/gitr" ]; then
            echo "❌ Error: scripts/gitr not found"
            echo "Please run this script from the GitK-RS project root directory"
            exit 1
        fi
        
        chmod +x scripts/gitr
        
        if [ -w "$INSTALL_DIR" ]; then
            cp scripts/gitr "$INSTALL_DIR/gitr"
            echo "✅ Gitr CLI installed to $INSTALL_DIR/gitr"
        else
            echo "ℹ️  Installing to $INSTALL_DIR requires elevated permissions"
            sudo cp scripts/gitr "$INSTALL_DIR/gitr"
            echo "✅ Gitr CLI installed to $INSTALL_DIR/gitr (using sudo)"
        fi
        
        chmod +x "$INSTALL_DIR/gitr"
        ;;
        
    MINGW*|MSYS*|CYGWIN*)
        # Windows (Git Bash/MSYS2)
        echo "🪟 Detected Windows"
        
        # Try to find bash bin directory
        if [ -d "/usr/local/bin" ]; then
            INSTALL_DIR="/usr/local/bin"
        elif [ -d "/bin" ]; then
            INSTALL_DIR="/bin"
        else
            INSTALL_DIR="$HOME/bin"
            mkdir -p "$INSTALL_DIR"
        fi
        
        if [ ! -f "scripts/gitr" ]; then
            echo "❌ Error: scripts/gitr not found"
            echo "Please run this script from the GitK-RS project root directory"
            exit 1
        fi
        
        chmod +x scripts/gitr
        cp scripts/gitr "$INSTALL_DIR/gitr"
        echo "✅ Gitr CLI installed to $INSTALL_DIR/gitr"
        
        # Also install .bat for cmd.exe
        if [ -f "scripts/gitr.bat" ]; then
            # Find system path for batch scripts
            BATCH_DIR="${APPDATA:-$HOME/AppData/Roaming}/Local/Microsoft/WindowsApps"
            if [ -w "$BATCH_DIR" ] || [ -w "C:\\Windows\\System32" ]; then
                echo "💡 Tip: Copy scripts/gitr.bat to a folder in your Windows PATH"
                echo "    or add 'git bash' commands to your PATH"
            fi
        fi
        ;;
        
    *)
        echo "❌ Error: Unsupported operating system: $OS_TYPE"
        exit 1
        ;;
esac

echo ""
echo "📝 Usage:"
echo "  gitr              - Opens current directory if it's a git repo"
echo "  gitr /path/to/repo - Opens the specified git repository"
echo ""
echo "🎉 Setup complete! You can now use 'gitr' from any git repository."
echo ""
echo "💡 Pro tip:"
echo "  Add an alias to your shell config for even faster access:"
echo "  alias gr='gitr'  # then just type 'gr'"
