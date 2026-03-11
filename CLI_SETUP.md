# GitK-RS CLI Setup Guide

Add GitK-RS to your system PATH so you can open any git repository with the `gitkrs` command.

## Installation

### macOS

1. **Copy the launch script to your PATH:**

```bash
# Using the provided setup script
bash scripts/install-cli.sh

# Or manually:
sudo cp scripts/gitkrs /usr/local/bin/gitkrs
sudo chmod +x /usr/local/bin/gitkrs
```

2. **Ensure GitK-RS is installed in `/Applications`:**
   - The app should be in `/Applications/gitk-rs.app`
   - If installed elsewhere, update the path in the launcher script

### Usage

**Open the current directory (if it's a git repo):**
```bash
cd /path/to/your/repo
gitkrs
```

**Open a specific repository:**
```bash
gitkrs /path/to/some/repo
```

**From anywhere:**
```bash
gitkrs ~/projects/my-project
```

## How It Works

1. The `gitkrs` command is a shell script that:
   - Validates the target directory is a git repository
   - Opens the GitK-RS application with that path
   
2. The app automatically loads the repository on startup

3. If the repository is invalid or not found, it shows an error message

## Troubleshooting

**"gitkrs: command not found"**
- Ensure you ran the installation script
- Check that `/usr/local/bin` is in your PATH: `echo $PATH`

**"is not a git repository"**
- Make sure the directory contains a `.git` folder

**App doesn't open**
- Verify GitK-RS is installed: `ls /Applications/gitk-rs.app`
- Try opening the app manually to check if it works

## Uninstalling

```bash
sudo rm /usr/local/bin/gitkrs
```
