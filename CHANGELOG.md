
All notable changes to Crystal will be documented in this file.

## [0.1.8] - 2025-06-25

### Added
- Ability to delete session folders for better session management
- Support for Intel Macs (x64 architecture)
- Linux AppImage build support in release process

### Fixed
- Git commit messages now truncate long prompts to prevent excessive commit message lengths
- Claude executable path override now properly uses the actual shell environment
- Various cleanup and stability improvements

## [0.1.7] - 2025-06-25

### Added
- Monaco-based file editor
- Support for subfolders in session organization

### Changed
- Improved terminal experience
- Enhanced visibility of "New Session" button for better user experience
- Sessions now default to 'Output' tab when switching between them

### Fixed
- Fixed output panel reload issue after git rebase operations
- Resolved diff panel unnecessary refreshes when making changes
- Fixed tab z-index layering issues
- Automatic process termination when removing projects to prevent orphaned processes

## [0.1.6] - 2025-06-24

### Fixed
- Resolved diff viewer scrollbar issues by simplifying CSS overflow handling
- Updated @anthropic-ai/claude-code package to version 1.0.33 to address security vulnerability

## [0.1.5] - 2025-06-19

### Added
- Toggle Auto-commit feature
- Editable diff viewer using Monaco Editor - make changes directly in the diff view with auto-save functionality
- Commit dialog - commit edited files directly from the diff viewer with a custom commit message

### Fixed
- Added Linux support for Claude Code process spawning
- Fixed diff viewer to properly display uncommitted changes
- Resolved performance issues with diff screen re-rendering

## [0.1.4] - 2025-06-18

### Added
