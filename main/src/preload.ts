import { contextBridge, ipcRenderer } from 'electron';

// Response type for IPC calls
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Generic invoke method for direct IPC calls
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  
  // Basic app info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  isPackaged: () => ipcRenderer.invoke('is-packaged'),

  // Version checking
  checkForUpdates: (): Promise<IPCResponse> => ipcRenderer.invoke('version:check-for-updates'),
  getVersionInfo: (): Promise<IPCResponse> => ipcRenderer.invoke('version:get-info'),
  
  // Auto-updater
  updater: {
    checkAndDownload: (): Promise<IPCResponse> => ipcRenderer.invoke('updater:check-and-download'),
    downloadUpdate: (): Promise<IPCResponse> => ipcRenderer.invoke('updater:download-update'),
    installUpdate: (): Promise<IPCResponse> => ipcRenderer.invoke('updater:install-update'),
  },

  // System utilities
  openExternal: (url: string): Promise<IPCResponse> => ipcRenderer.invoke('openExternal', url),

  // Session management
  sessions: {
    getAll: (): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-all'),
    getAllWithProjects: (): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-all-with-projects'),
    get: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get', sessionId),
    create: (request: any): Promise<IPCResponse> => ipcRenderer.invoke('sessions:create', request),
    delete: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:delete', sessionId),
    sendInput: (sessionId: string, input: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:input', sessionId, input),
    continue: (sessionId: string, prompt?: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:continue', sessionId, prompt),
    getOutput: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-output', sessionId),
    getConversation: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-conversation', sessionId),
    markViewed: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:mark-viewed', sessionId),
    stop: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:stop', sessionId),
    
    // Execution and Git operations
    getExecutions: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-executions', sessionId),
    getExecutionDiff: (sessionId: string, executionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-execution-diff', sessionId, executionId),
    gitCommit: (sessionId: string, message: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:git-commit', sessionId, message),
    gitDiff: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:git-diff', sessionId),
    getCombinedDiff: (sessionId: string, executionIds?: number[]): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-combined-diff', sessionId, executionIds),
    
    // Main repo session
    getOrCreateMainRepoSession: (projectId: number): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-or-create-main-repo', projectId),
    
    // Script operations
    hasRunScript: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:has-run-script', sessionId),
    getRunningSession: (): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-running-session'),
    runScript: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:run-script', sessionId),
    stopScript: (): Promise<IPCResponse> => ipcRenderer.invoke('sessions:stop-script'),
    runTerminalCommand: (sessionId: string, command: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:run-terminal-command', sessionId, command),
    sendTerminalInput: (sessionId: string, data: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:send-terminal-input', sessionId, data),
    preCreateTerminal: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:pre-create-terminal', sessionId),
    resizeTerminal: (sessionId: string, cols: number, rows: number): Promise<IPCResponse> => ipcRenderer.invoke('sessions:resize-terminal', sessionId, cols, rows),
    
    // Prompt operations
    getPrompts: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-prompts', sessionId),
    
    // Git rebase operations
    rebaseMainIntoWorktree: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:rebase-main-into-worktree', sessionId),
    abortRebaseAndUseClaude: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:abort-rebase-and-use-claude', sessionId),
    squashAndRebaseToMain: (sessionId: string, commitMessage: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:squash-and-rebase-to-main', sessionId, commitMessage),
    rebaseToMain: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:rebase-to-main', sessionId),
    
    // Git pull/push operations
    gitPull: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:git-pull', sessionId),
    gitPush: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:git-push', sessionId),
    getLastCommits: (sessionId: string, count: number): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-last-commits', sessionId, count),
    
    // Git operation helpers
    hasChangesToRebase: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:has-changes-to-rebase', sessionId),
    getGitCommands: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:get-git-commands', sessionId),
    generateName: (prompt: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:generate-name', prompt),
    rename: (sessionId: string, newName: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:rename', sessionId, newName),
    toggleFavorite: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:toggle-favorite', sessionId),
    toggleAutoCommit: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:toggle-auto-commit', sessionId),
    
    // IDE operations
    openIDE: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('sessions:open-ide', sessionId),
    
    // Reorder operations
    reorder: (sessionOrders: Array<{ id: string; displayOrder: number }>): Promise<IPCResponse> => ipcRenderer.invoke('sessions:reorder', sessionOrders),
    
    // Image operations
    saveImages: (sessionId: string, images: Array<{ name: string; dataUrl: string; type: string }>): Promise<string[]> => ipcRenderer.invoke('sessions:save-images', sessionId, images),
  },

  // Project management
  projects: {
    getAll: (): Promise<IPCResponse> => ipcRenderer.invoke('projects:get-all'),
    getActive: (): Promise<IPCResponse> => ipcRenderer.invoke('projects:get-active'),
    create: (projectData: any): Promise<IPCResponse> => ipcRenderer.invoke('projects:create', projectData),
    activate: (projectId: string): Promise<IPCResponse> => ipcRenderer.invoke('projects:activate', projectId),
    update: (projectId: string, updates: any): Promise<IPCResponse> => ipcRenderer.invoke('projects:update', projectId, updates),
    delete: (projectId: string): Promise<IPCResponse> => ipcRenderer.invoke('projects:delete', projectId),
    detectBranch: (path: string): Promise<IPCResponse> => ipcRenderer.invoke('projects:detect-branch', path),
    reorder: (projectOrders: Array<{ id: number; displayOrder: number }>): Promise<IPCResponse> => ipcRenderer.invoke('projects:reorder', projectOrders),
    listBranches: (projectId: string): Promise<IPCResponse> => ipcRenderer.invoke('projects:list-branches', projectId),
  },

  // Git operations
  git: {
    detectBranch: (path: string): Promise<IPCResponse<string>> => ipcRenderer.invoke('projects:detect-branch', path),
  },

  // Folders
  folders: {
    getByProject: (projectId: number): Promise<IPCResponse> => ipcRenderer.invoke('folders:get-by-project', projectId),
    create: (name: string, projectId: number): Promise<IPCResponse> => ipcRenderer.invoke('folders:create', name, projectId),
    update: (folderId: string, updates: { name?: string; display_order?: number }): Promise<IPCResponse> => ipcRenderer.invoke('folders:update', folderId, updates),
    delete: (folderId: string): Promise<IPCResponse> => ipcRenderer.invoke('folders:delete', folderId),
    reorder: (projectId: number, folderIds: string[]): Promise<IPCResponse> => ipcRenderer.invoke('folders:reorder', projectId, folderIds),
    moveSession: (sessionId: string, folderId: string | null): Promise<IPCResponse> => ipcRenderer.invoke('folders:move-session', sessionId, folderId),
  },

  // Configuration
  config: {
    get: (): Promise<IPCResponse> => ipcRenderer.invoke('config:get'),
    update: (updates: any): Promise<IPCResponse> => ipcRenderer.invoke('config:update', updates),
  },

  // Prompts
  prompts: {
    getAll: (): Promise<IPCResponse> => ipcRenderer.invoke('prompts:get-all'),
    getByPromptId: (promptId: string): Promise<IPCResponse> => ipcRenderer.invoke('prompts:get-by-id', promptId),
  },

  // Dialog
  dialog: {
    openFile: (options?: any): Promise<IPCResponse<string | null>> => ipcRenderer.invoke('dialog:open-file', options),
    openDirectory: (options?: any): Promise<IPCResponse<string | null>> => ipcRenderer.invoke('dialog:open-directory', options),
  },

  // Permissions
  permissions: {
    respond: (requestId: string, response: any): Promise<IPCResponse> => ipcRenderer.invoke('permission:respond', requestId, response),
    getPending: (): Promise<IPCResponse> => ipcRenderer.invoke('permission:getPending'),
  },

  // Stravu OAuth integration
  stravu: {
    getConnectionStatus: (): Promise<IPCResponse> => ipcRenderer.invoke('stravu:get-connection-status'),
    initiateAuth: (): Promise<IPCResponse> => ipcRenderer.invoke('stravu:initiate-auth'),
    checkAuthStatus: (sessionId: string): Promise<IPCResponse> => ipcRenderer.invoke('stravu:check-auth-status', sessionId),
    disconnect: (): Promise<IPCResponse> => ipcRenderer.invoke('stravu:disconnect'),
    getNotebooks: (): Promise<IPCResponse> => ipcRenderer.invoke('stravu:get-notebooks'),
    getNotebook: (notebookId: string): Promise<IPCResponse> => ipcRenderer.invoke('stravu:get-notebook', notebookId),
    searchNotebooks: (query: string, limit?: number): Promise<IPCResponse> => ipcRenderer.invoke('stravu:search-notebooks', query, limit),
  },

  // UI State management
  uiState: {
    getExpanded: (): Promise<IPCResponse> => ipcRenderer.invoke('ui-state:get-expanded'),
    saveExpanded: (projectIds: number[], folderIds: string[]): Promise<IPCResponse> => ipcRenderer.invoke('ui-state:save-expanded', projectIds, folderIds),
    saveExpandedProjects: (projectIds: number[]): Promise<IPCResponse> => ipcRenderer.invoke('ui-state:save-expanded-projects', projectIds),
    saveExpandedFolders: (folderIds: string[]): Promise<IPCResponse> => ipcRenderer.invoke('ui-state:save-expanded-folders', folderIds),
  },

  // Event listeners for real-time updates
  events: {
    // Session events
    onSessionCreated: (callback: (session: any) => void) => {
      ipcRenderer.on('session:created', (_event, session) => callback(session));
      return () => ipcRenderer.removeAllListeners('session:created');
    },
    onSessionUpdated: (callback: (session: any) => void) => {
      ipcRenderer.on('session:updated', (_event, session) => callback(session));
      return () => ipcRenderer.removeAllListeners('session:updated');
    },
    onSessionDeleted: (callback: (session: any) => void) => {
      ipcRenderer.on('session:deleted', (_event, session) => callback(session));
      return () => ipcRenderer.removeAllListeners('session:deleted');
    },
    onSessionsLoaded: (callback: (sessions: any[]) => void) => {
      ipcRenderer.on('sessions:loaded', (_event, sessions) => callback(sessions));
      return () => ipcRenderer.removeAllListeners('sessions:loaded');
    },
    onSessionOutput: (callback: (output: any) => void) => {
      ipcRenderer.on('session:output', (_event, output) => callback(output));
      return () => ipcRenderer.removeAllListeners('session:output');
    },
    onSessionOutputAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('session:output-available', (_event, info) => callback(info));
      return () => ipcRenderer.removeAllListeners('session:output-available');
    },
    
    // Project events
    onProjectUpdated: (callback: (project: any) => void) => {
      ipcRenderer.on('project:updated', (_event, project) => callback(project));
      return () => ipcRenderer.removeAllListeners('project:updated');
    },
    
    // Folder events
    onFolderCreated: (callback: (folder: any) => void) => {
      ipcRenderer.on('folder:created', (_event, folder) => callback(folder));
      return () => ipcRenderer.removeAllListeners('folder:created');
    },
    onFolderUpdated: (callback: (folder: any) => void) => {
      ipcRenderer.on('folder:updated', (_event, folder) => callback(folder));
      return () => ipcRenderer.removeAllListeners('folder:updated');
    },
    onFolderDeleted: (callback: (folderId: string) => void) => {
      ipcRenderer.on('folder:deleted', (_event, folderId) => callback(folderId));
      return () => ipcRenderer.removeAllListeners('folder:deleted');
    },
    
    onScriptOutput: (callback: (output: any) => void) => {
      ipcRenderer.on('script:output', (_event, output) => callback(output));
      return () => ipcRenderer.removeAllListeners('script:output');
    },

    // Generic event cleanup
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
    
    // Main process logging
    onMainLog: (callback: (level: string, message: string) => void) => {
      ipcRenderer.on('main-log', (_event, level, message) => callback(level, message));
      return () => ipcRenderer.removeAllListeners('main-log');
    },

    // Version updates
    onVersionUpdateAvailable: (callback: (versionInfo: any) => void) => {
      ipcRenderer.on('version:update-available', (_event, versionInfo) => callback(versionInfo));
      return () => ipcRenderer.removeAllListeners('version:update-available');
    },
    
    // Auto-updater events
    onUpdaterCheckingForUpdate: (callback: () => void) => {
      ipcRenderer.on('updater:checking-for-update', (_event) => callback());
      return () => ipcRenderer.removeAllListeners('updater:checking-for-update');
    },
    onUpdaterUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('updater:update-available', (_event, info) => callback(info));
      return () => ipcRenderer.removeAllListeners('updater:update-available');
    },
    onUpdaterUpdateNotAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('updater:update-not-available', (_event, info) => callback(info));
      return () => ipcRenderer.removeAllListeners('updater:update-not-available');
    },
    onUpdaterDownloadProgress: (callback: (progressInfo: any) => void) => {
      ipcRenderer.on('updater:download-progress', (_event, progressInfo) => callback(progressInfo));
      return () => ipcRenderer.removeAllListeners('updater:download-progress');
    },
    onUpdaterUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('updater:update-downloaded', (_event, info) => callback(info));
      return () => ipcRenderer.removeAllListeners('updater:update-downloaded');
    },
    onUpdaterError: (callback: (error: any) => void) => {
      ipcRenderer.on('updater:error', (_event, error) => callback(error));
      return () => ipcRenderer.removeAllListeners('updater:error');
    },
    
    // Process management events
    onZombieProcessesDetected: (callback: (data: any) => void) => {
      ipcRenderer.on('zombie-processes-detected', (_event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('zombie-processes-detected');
    },
  },

  // Debug utilities
  debug: {
    getTableStructure: (tableName: 'folders' | 'sessions'): Promise<IPCResponse> => ipcRenderer.invoke('debug:get-table-structure', tableName),
  },
});

// Expose electron event listeners and utilities for permission requests
contextBridge.exposeInMainWorld('electron', {
  openExternal: (url: string) => ipcRenderer.invoke('openExternal', url),
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['permission:request'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['permission:request'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
});