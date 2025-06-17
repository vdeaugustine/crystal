# Changelog

All notable changes to Crystal will be documented in this file.

## [0.1.3] - 2025-06-17

### Added
- Image support - Claude can now read and analyze images through the Read tool

### Changed
- Replaced custom diff viewer with react-diff-viewer-continued for better performance and reliability
- Improved state management by removing global refreshes for targeted updates
- Diff viewer now supports full-screen mode for better visibility

### Fixed
- Dark mode rendering problems
- Session list and output loading reliability
- Misc UX improvements

## [0.1.2] - 2025-06-14

### Added
- Dark mode support throughout the application with proper light/dark theme switching
- Merge conflict resolution button to help resolve git conflicts using Claude
- Rebase without squash option for more flexible git operations
- Create new worktrees off of any branch

### Changed
- Improved welcome screen logic to avoid repeatedly showing to returning users
- Cleaned up Claude Code JSON output display for better formatting
- Proper dark mode
- Many UX improvements

### Fixed
- Session status indicators now properly show completed and viewed states with gray dot
- Electron update functionality now works properly from inside the app...hopefully

## [0.1.1] - Previous Release

Initial public release of Crystal with core features for managing multiple Claude Code sessions.