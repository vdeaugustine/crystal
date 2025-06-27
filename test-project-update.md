# Test Plan: Project Update Event Flow

## Issue
When updating a project's run script in the ProjectSettings dialog, the SessionListItem components don't refresh to show/hide the run script button.

## Root Cause
The SessionListItem was checking for `window.api?.events?.onProjectUpdated` but the preload script exposes it as `window.electronAPI.events.onProjectUpdated`.

## Fix Applied
1. **SessionListItem.tsx**: Changed `window.api?.events?.onProjectUpdated` to `window.electronAPI?.events?.onProjectUpdated`
2. **DraggableProjectTreeView.tsx**: Added a listener for `onProjectUpdated` to update project data in the tree view

## Event Flow
1. User updates project settings (including run script) in ProjectSettings dialog
2. ProjectSettings calls API.projects.update() 
3. IPC handler in `main/src/ipc/project.ts` updates the database and emits `project:updated` event
4. Event is handled in `main/src/events.ts` and forwarded to renderer via `project:updated` IPC event
5. Frontend components listening to `window.electronAPI.events.onProjectUpdated` receive the update:
   - SessionListItem: Re-checks if run script exists and updates button visibility
   - DraggableProjectTreeView: Updates project data in state

## Testing Steps
1. Create a project without a run script
2. Create a session in that project
3. Verify no run script button appears in SessionListItem
4. Open project settings and add a run script
5. Save the settings
6. Verify the run script button now appears in SessionListItem without refreshing

## Additional Components That Listen for Project Updates
- DraggableProjectTreeView (now listens after our fix)
- ProjectSelector (refreshes project list on update)