# Gitr - GitK-RS CLI Setup Guide

Add Gitr to your system PATH so you can open any git repository with the `gitr` command.

Works on **macOS**, **Linux**, and **Windows**.

## Installation

### macOS

```bash
# Run the setup script
bash scripts/install-gitr.sh

# Or manually:
chmod +x scripts/gitr
sudo cp scripts/gitr /usr/local/bin/gitr
```

### Linux

```bash
# Run the setup script
bash scripts/install-gitr.sh

# Or manually:
chmod +x scripts/gitr
sudo cp scripts/gitr /usr/local/bin/gitr
```

### Windows (Git Bash / MSYS2)

```bash
# Run the setup script
bash scripts/install-gitr.sh

# The script will install gitr to your Git Bash bin directory
# Then use it in Git Bash, PowerShell, or CMD
```

### Windows (Command Prompt / PowerShell)

1. Copy `scripts/gitr.bat` to a folder in your PATH
   - Options: `C:\Program Files\Git\cmd\`, `C:\Windows\System32\`, or any folder in your PATH
2. Or add the scripts folder to your PATH environment variable

## Usage

**Open the current directory (if it's a git repo):**
```bash
cd /path/to/your/repo
gitr
```

**Open a specific repository:**
```bash
gitr /path/to/some/repo
```

**From anywhere:**
```bash
gitr ~/projects/my-project
```

**Quick alias (optional):**
Add to your `.bashrc`, `.zshrc`, or shell config:
```bash
alias gr='gitr'  # then just type 'gr'
```

## How It Works

1. The `gitr` command is a script that:
   - Validates the target directory is a git repository
   - Detects your operating system
   - Opens GitK-RS with that path
   
2. The app automatically loads the repository

3. If invalid or not found, it shows a helpful error message

## Troubleshooting

### "gitr: command not found"
- **macOS/Linux**: Ensure you ran the installation script
- **Windows**: Copy `gitr.bat` to a folder in your PATH or use Git Bash

### "is not a git repository"
- Make sure the directory contains a `.git` folder

### App doesn't open
- Verify GitK-RS is installed properly
- Try opening the app manually to check if it works

### Wrong installation directory
- macOS/Linux: Run `which gitr` to check location
- Windows: Run `where gitr` in CMD

## Uninstalling

### macOS / Linux
```bash
sudo rm /usr/local/bin/gitr
```

### Windows
Delete `gitr.bat` from wherever you placed it

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | ✅ | Full support via shell script |
| Linux | ✅ | Full support via shell script |
| Windows (Git Bash) | ✅ | Use shell script `gitr` |
| Windows (CMD/PowerShell) | ✅ | Use batch script `gitr.bat` |
