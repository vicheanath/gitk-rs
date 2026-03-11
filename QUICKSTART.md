# Quick Start Guide

Get GitK-RS running in 5 minutes!

## 1. Install the App

Download the latest `.dmg` from [GitHub Releases](https://github.com/vicheanath/gitk-rs/releases) and drag the app to your Applications folder.

## 2. First Run

1. Open GitK-RS from Applications
2. Click "Open Repository"
3. Select any `.git` folder
4. Explore your repository! 🎉

## 3. (Optional) Set Up CLI

Want to jump to any repo instantly from your terminal?

```bash
# Copy and run this:
bash /Applications/gitk-rs.app/Contents/Resources/scripts/install-cli.sh

# Then anywhere:
cd ~/my-project
gitkrs
```

## Tips

- **Search commits**: Press ⌘F to search by message, author, or hash
- **Keyboard navigation**: Use ↑↓ arrows to navigate commits
- **Dark/Light theme**: Toggle in Settings (⌘,)
- **Resize panels**: Drag dividers to customize layout
- **Compare diffs**: Click a commit to see file changes

## Troubleshooting

**"Cannot open app"** → Right-click the app and select "Open"

**"gitkrs not found"** → Run the install script again and check your PATH: `echo $PATH`

**"Not a git repository"** → Make sure the folder contains a `.git` directory

## Next Steps

- Check out [CLI_SETUP.md](./CLI_SETUP.md) for advanced CLI usage
- Read [CONTRIBUTING.md](./CONTRIBUTING.md) to help improve GitK-RS
- Leave a ⭐ on GitHub if you like it!

---

**Questions?** Open an issue on [GitHub](https://github.com/vicheanath/gitk-rs/issues)
