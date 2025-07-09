# Changes to Remove Main Branch Selection

## Summary
Updated Crystal to always auto-detect the main branch from the git repository instead of allowing users to set it during project creation. The main branch can still be overridden in project settings for advanced use cases.

## Changes Made

### Frontend Changes

1. **ProjectSelector.tsx**
   - Removed `mainBranch` field from new project state
   - Added `detectedBranch` state to show the auto-detected branch
   - Updated UI to show "Current Branch (Auto-detected)" as read-only field
   - Removed the ability to manually set main branch during project creation

2. **ProjectSettings.tsx**
   - Added `mainBranch` state for editing existing projects
   - Added "Main Branch Override (Advanced)" field that allows users to override the auto-detected branch
   - Added warning note explaining that this override affects git operations like "Rebase from main"

### Backend Changes

1. **worktreeManager.ts**
   - Added `getEffectiveMainBranch()` method that:
     - Returns the project's `main_branch` override if set
     - Otherwise auto-detects the main branch using `getProjectMainBranch()`

2. **ipc/git.ts**
   - Updated all git operations to use `getEffectiveMainBranch()` instead of `getProjectMainBranch()`
   - This ensures the override is respected when set

3. **ipc/project.ts**
   - Removed use of `projectData.mainBranch` when creating new projects
   - Always uses 'main' as the default branch name for new git repos
   - Always auto-detects the main branch after project creation

4. **database/database.ts**
   - Re-enabled the ability to update `main_branch` field in the database
   - This allows the override to be saved

5. **Migration**
   - Added `deprecate_main_branch.sql` migration that documents the change in behavior
   - The field is kept for backward compatibility and as an override mechanism

### Additional Frontend Fixes

1. **MainBranchWarningDialog Display**
   - Fixed issue where the dialog showed cached branch names instead of the current branch
   - Both `ProjectTreeView.tsx` and `DraggableProjectTreeView.tsx` now:
     - Fetch the current branch before showing the warning dialog
     - Pass the detected branch to the dialog instead of the cached `main_branch` field
   - Added `detectedMainBranch` and `detectedBranchForNewProject` states to track current branches

2. **Project Creation Dialogs**
   - Updated both tree view components to remove main branch input fields
   - Show auto-detected branch as read-only information during project creation

### Additional Backend Fixes

1. **Fixed "Session not found" Error for Terminal Input**
   - **sessionManager.ts**: Updated `sendTerminalInput` and `preCreateTerminalSession` methods
   - These methods now fall back to fetching session information from the database when the session is not in the activeSessions map
   - This fixes the error that occurred when trying to send terminal input to sessions that don't have an active Claude Code process (e.g., terminal-only sessions)

## Behavior

- **New Projects**: Main branch is always auto-detected from the repository
- **Existing Projects**: Continue to work as before, with auto-detection if no override is set
- **Project Settings**: Users can set a main branch override for cases where the auto-detection doesn't work correctly
- **Git Operations**: All git operations (rebase, squash, etc.) respect the override if set, otherwise use auto-detection
- **Warning Dialogs**: Always show the actual current branch, never cached values