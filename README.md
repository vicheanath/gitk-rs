# GitK-RS

A modern Git visualization tool written in Rust with a React frontend, built with Tauri.

## Features

- **Commit Graph Visualization**: Interactive DAG visualization with zoom, pan, and node selection
- **Branch Management**: View, create, checkout, and delete branches
- **Tag Browsing**: Explore repository tags
- **Commit Details**: View commit metadata, changed files, and diffs
- **Search**: Search commits by message
- **Keyboard Shortcuts**: Navigate efficiently with keyboard
- **Dark/Light Theme**: Toggle between themes
- **Cross-platform**: Works on Linux, macOS, and Windows

## Prerequisites

- Node.js (v18 or later)
- Rust (latest stable)
- Git (for the repository you want to visualize)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gitk-rs.git
cd gitk-rs
```

2. Install dependencies:
```bash
npm install
```

3. Build the application:
```bash
npm run tauri build
```

## Development

Run the development server:

```bash
npm run tauri dev
```

This will start the Vite dev server and launch the Tauri application.

## Usage

1. Launch the application
2. Click "Open Repository" and select a Git repository
3. Explore the commit graph, branches, and tags
4. Click on commits to view details and diffs
5. Use keyboard shortcuts for quick navigation

## Keyboard Shortcuts

- `/` - Focus search bar
- `b` - Toggle sidebar
- `q` - Quit application
- Arrow keys - Navigate commits (coming soon)

## Project Structure

```
gitk-rs/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── git_engine/ # Git operations
│   │   ├── app_core/   # State management
│   │   └── commands.rs # Tauri commands
│   └── Cargo.toml
├── src/                # React frontend
│   ├── components/     # UI components
│   ├── hooks/          # React hooks
│   ├── types/          # TypeScript types
│   └── styles/         # CSS styles
└── package.json
```

## Technologies

- **Backend**: Rust, libgit2, Tauri
- **Frontend**: React, TypeScript, Vite
- **State Management**: React Context API (MVVM pattern)
- **Graph Library**: Petgraph (Rust), Canvas API (JavaScript)

## License

MIT

