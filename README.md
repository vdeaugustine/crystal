# Crystal - Multi-Session Claude Code Manager

<div align="center">
  <h3><a href="https://github.com/stravu/crystal/releases/latest">**Get the Latest Release Here**</a></h3>
</div>


Crystal is an Electron desktop application that lets you run, inspect, and test multiple Claude Code instances simultaneously using git worktrees. Crystal is an independent project created by [Stravu](https://stravu.com/). Stravu is the way AI-first teams collaborate.

<div align="center">
  <img src="screenshots/screenshot-create.png" alt="Creating a new Claude Code session" width="800">
  <p><em>Create multiple Claude Code sessions with a simple prompt, each running in its own git worktree</em></p>
  <br>
  
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="screenshots/screenshot-diff.png" alt="Viewing git diff and commit history" width="100%">
        <p><em>Track all changes with built-in git diff viewer showing additions, deletions, and commit history</em></p>
      </td>
      <td align="center" width="50%">
        <img src="screenshots/screenshot-run.png" alt="Snake game running in browser" width="100%">
        <p><em>Test your code instantly - run your worktree directly from Crystal</em></p>
      </td>
    </tr>
  </table>
</div>


## ✨ Key Features

- **🚀 Parallel Sessions** - Run multiple Claude Code instances at once
- **🌳 Git Worktree Isolation** - Each session gets its own branch
- **💾 Session Persistence** - Resume conversations anytime
- **🔧 Git Integration** - Built-in rebase and squash operations
- **📊 Change Tracking** - View diffs and track modifications
- **🔔 Notifications** - Desktop alerts when sessions need input
- **🏗️ Run Scripts** - Test changes instantly without leaving Crystal

## 🚀 Quick Start

### Prerequisites
- Claude Code installed and logged in or API key provided
- Git installed
- Git repository (Crystal will initialize one if needed)

### Installation

#### Download Pre-built Binaries

- **macOS**: Download `Crystal-{version}.dmg` from the [latest release](https://github.com/stravu/crystal/releases/latest)
  - Open the DMG file and drag Crystal to your Applications folder
  - On first launch, you may need to right-click and select "Open" due to macOS security settings


### Building from Source

```bash
# Clone the repository
git clone https://github.com/stravu/crystal.git
cd crystal

# One-time setup
pnpm run setup

# Run in development
pnpm run electron-dev
```

### Building for Production

```bash
# Build for macOS
pnpm build:mac
```

### Developing Crystal with Crystal

If you're using Crystal to develop Crystal itself, you need to use a separate data directory to avoid conflicts with your main Crystal instance:

```bash
# Set the run script in your Crystal project settings to:
pnpm run setup && CRYSTAL_DIR=~/.crystal_test pnpm electron-dev
```

This ensures:
- Your development Crystal instance uses `~/.crystal_test` for its data
- Your main Crystal instance continues using `~/.crystal` 
- Worktrees won't conflict between the two instances
- You can safely test changes without affecting your primary Crystal setup

## 📖 How to Use

### 1. Create a Project
You must create a project before you can proceed. A project should point to a git repository. If there is no repo in the folder you select one will be created.

### 2. Create a Session
Click "Create Session" and enter:
- **Prompt**: What you want Claude to do
- **Worktree Name**: Branch name (optional)
- **Count**: Number of parallel sessions

### 3. Manage Sessions
- **🟢 Running**: Claude is working
- **🟡 Waiting**: Needs your input
- **⚪ Stopped**: Completed or paused
- Click any session to view or continue it

### 4. View Your Work
- **Output**: Formatted terminal output
- **Changes**: Git diffs of all modifications
- **Terminal**: Run tests or build scripts
- **Messages**: Raw JSON for debugging

### 5. Run Scripts
Configure project-specific scripts in the project settings:
- **Run scripts**: Execute dev servers, test watchers, or any continuous processes
- Scripts run in the Terminal tab while Claude is working
- Each line runs sequentially - perfect for setup commands followed by servers
- All scripts stop automatically when the session ends

### 6. Git Operations
- **Rebase from main**: Pull latest changes
- **Squash and rebase**: Combine commits
- Preview commands before executing

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

Crystal is open source software licensed under the [MIT License](LICENSE).

## Disclaimer

Crystal is an independent project created by [Stravu](https://stravu.com/). Claude™ is a trademark of Anthropic, PBC. Crystal is not affiliated with, endorsed by, or sponsored by Anthropic. This tool is designed to work with Claude Code, which must be installed separately.

---

<div align="center">
  <img src="frontend/public/stravu-logo.png" alt="Stravu Logo" width="80" height="80">
  <br>
  Made with ❤️ by <a href="https://stravu.com/">Stravu</a>
</div>
