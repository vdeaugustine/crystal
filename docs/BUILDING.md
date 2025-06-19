# Building Crystal

This document describes how to build Crystal for different platforms.

## Prerequisites

- Node.js 22.15.1 or higher
- pnpm 8.0.0 or higher
- Python 3.11 (for native module rebuilds)

## Building for macOS

```bash
# Development build
pnpm run build:mac

# Release build (with code signing)
pnpm run release:mac
```

## Building for Linux

Crystal can be built in multiple formats for Linux:

### Standard Build (DEB, AppImage, Snap)

```bash
# Development build
pnpm run build:linux

# Release build
pnpm run release:linux
```

This will create:
- `.deb` package for Debian/Ubuntu
- `.AppImage` for universal Linux distribution
- `.snap` package for Snap-enabled systems

### Flatpak Build

Flatpak packages are built separately after creating the AppImage:

```bash
# First build the AppImage
pnpm run build:linux

# Then build the Flatpak
./scripts/build-flatpak.sh
```

This will create a `crystal.flatpak` bundle that can be installed with:
```bash
flatpak install crystal.flatpak
```

## GitHub Actions

The project includes automated builds via GitHub Actions:

- **build.yml**: Runs on every push and PR, builds for macOS and Linux
- **release.yml**: Runs on version tags (e.g., v1.0.0), creates GitHub releases

## Architecture Support

- **macOS**: Universal binary (Intel and Apple Silicon)
- **Linux**: x64 architecture only (arm64 support planned)

## Troubleshooting

### Linux Build Errors

If you encounter "author email missing" errors, ensure the package.json has a proper author field with email.

### Flatpak Build Issues

- Ensure `flatpak-builder` is installed: `sudo apt install flatpak-builder`
- Install required runtimes: `flatpak install flathub org.freedesktop.Platform//23.08`

### Native Module Issues

If you encounter issues with native modules:
```bash
pnpm run electron:rebuild
```