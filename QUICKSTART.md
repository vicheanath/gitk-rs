# Quick Start Guide

Get GitK-RS running in 5 minutes!

## 1. Install the App

Download the latest `.dmg` from [GitHub Releases](https://github.com/vicheanath/gitk-rs/releases) and drag the app to your Applications folder.

Or install on Linux/Windows via your package manager.

## 2. First Run

1. Open GitK-RS
2. Click "Open Repository"
3. Select any `.git` folder
4. Explore your repository! 🎉

## 3. (Optional) Set Up Gitr CLI

Want to jump to any repo instantly from your terminal?

### macOS / Linux
```bash
bash scripts/install-gitr.sh

# Then anywhere:
cd ~/my-project
gitr
```

### Windows (Git Bash)
```bash
bash scripts/install-gitr.sh
# Then use 'gitr' in Git Bash
```

### Windows (CMD/PowerShell)
Copy `scripts/gitr.bat` to your Windows PATH folder, then:
```cmd
gitr C:\path\to\repo
```

## Tips

- **Search commits**: Press ⌘F (or Ctrl+F) to search
- **Keyboard navigation**: Use ↑↓ arrows to navigate commits
- **Dark/Light theme**: Toggle in Settings
- **Resize panels**: Drag dividers to customize layout
- **Compare diffs**: Click a commit to see file changes

## Troubleshooting

**"Cannot open app"** → Right-click the app and select "Open"

**"gitr not found"** → Run the install script again and ensure the folder is in your PATH

**"Not a git repository"** → Make sure the folder contains a `.git` directory

## Next Steps

- Check out [CLI_SETUP.md](./CLI_SETUP.md) for advanced CLI usage
- Join our community on [GitHub](https://github.com/vicheanath/gitk-rs)
- Leave a ⭐ if you like it!

---

**Questions?** Open an issue on [GitHub](https://github.com/vicheanath/gitk-rs/issues)
