# GitK-RS - Git Visualization Tool

A modern, Rust-powered Git visualization tool built with Tauri and React.

## Features

- 📊 Interactive commit graph visualization
- 🔍 Advanced search and filtering
- 📝 Detailed commit information and diffs
- 🌳 Branch and tag management
- 🎨 Dark/Light theme support
- ⚡ Lightning-fast performance powered by Rust

## Installation

### macOS App

Download the latest release from the [GitHub Releases](https://github.com/vicheanath/gitk-rs/releases) page.

### CLI Setup (Optional)

Add GitK-RS to your command line for quick access from any git repository:

```bash
# 1. Run the CLI setup script
bash scripts/install-cli.sh

# 2. Now you can use 'gitkrs' from anywhere:
cd /path/to/your/repo
gitkrs
```

For detailed CLI setup instructions, see [CLI_SETUP.md](./CLI_SETUP.md)

## Usage

### Opening a Repository

1. Launch GitK-RS
2. Click "Open Repository" on the landing page
3. Select a git repository folder

### Using the CLI

After setting up the CLI:

```bash
# Open current repository
gitkrs

# Open a specific repository  
gitkrs /path/to/repo

# From anywhere
gitkrs ~/projects/my-project
```

### Keyboard Shortcuts

- **⌘B** - Toggle sidebar
- **⌘F** - Focus search
- **⌘R** - Reload graph
- **⌘O** - Open repository
- **⌘,** - Settings
- **↑/↓** - Navigate commits
- **⌘/** - Keyboard shortcuts reference

## Development

### Prerequisites

- Node.js 18+
- Rust (for Tauri backend)
- macOS 10.13+ (for development)

### Setup

```bash
# Install dependencies
npm install

# Run dev mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Development Commands

```bash
# Start web dev server
npm run dev

# Type check
npm run build

# Tauri-specific commands
npm run tauri build    # Build release
npm run tauri dev      # Dev mode with hot reload
```

## Project Structure

```
src/
├── components/      # React components
├── context/         # State management
├── hooks/          # Custom React hooks
├── viewmodels/     # Logic layer
├── utils/          # Utilities
└── types/          # TypeScript types

src-tauri/          # Rust backend
├── src/
│   ├── commands.rs # IPC commands
│   ├── git_engine/ # Git operations
│   └── auth/       # Authentication
└── Cargo.toml      # Rust dependencies

scripts/            # CLI launcher scripts
├── gitkrs          # Main CLI launcher
└── install-cli.sh  # Installation helper
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Version

Currently at **v1.0.1**

See [CHANGELOG.md](./CHANGELOG.md) for version history.
