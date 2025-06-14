import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { execSync } from './utils/commandExecutor';
import { TaskQueue } from './services/taskQueue';
import { SessionManager } from './services/sessionManager';
import { ConfigManager } from './services/configManager';
import { WorktreeManager } from './services/worktreeManager';
import { WorktreeNameGenerator } from './services/worktreeNameGenerator';
import { GitDiffManager, type GitDiffResult } from './services/gitDiffManager';
import { ExecutionTracker } from './services/executionTracker';
import { DatabaseService } from './database/database';
import { RunCommandManager } from './services/runCommandManager';
import { PermissionIpcServer } from './services/permissionIpcServer';
import { PermissionManager } from './services/permissionManager';
import { VersionChecker, type VersionInfo } from './services/versionChecker';
import { StravuAuthManager } from './services/stravuAuthManager';
import { StravuNotebookService } from './services/stravuNotebookService';
import { Logger } from './utils/logger';
import { setCrystalDirectory } from './utils/crystalDirectory';
import type { CreateSessionRequest } from './types/session';

let mainWindow: BrowserWindow | null = null;
let taskQueue: TaskQueue | null = null;

// Service instances
let configManager: ConfigManager;
let logger: Logger;
let sessionManager: SessionManager;
let worktreeManager: WorktreeManager;
let claudeCodeManager: any;
let gitDiffManager: GitDiffManager;
let executionTracker: ExecutionTracker;
let worktreeNameGenerator: WorktreeNameGenerator;
let databaseService: DatabaseService;
let runCommandManager: RunCommandManager;
let permissionIpcServer: PermissionIpcServer | null;
let versionChecker: VersionChecker;
let stravuAuthManager: StravuAuthManager;
let stravuNotebookService: StravuNotebookService;

// Store original console methods before overriding
let originalLog: typeof console.log;
let originalError: typeof console.error;
let originalWarn: typeof console.warn;
let originalInfo: typeof console.info;

const isDevelopment = process.env.NODE_ENV !== 'production' && !app.isPackaged;

// Parse command-line arguments for custom Crystal directory
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  // Support both --crystal-dir=/path and --crystal-dir /path formats
  if (arg.startsWith('--crystal-dir=')) {
    const dir = arg.substring('--crystal-dir='.length);
    setCrystalDirectory(dir);
    console.log(`[Main] Using custom Crystal directory: ${dir}`);
  } else if (arg === '--crystal-dir' && i + 1 < args.length) {
    const dir = args[i + 1];
    setCrystalDirectory(dir);
    console.log(`[Main] Using custom Crystal directory: ${dir}`);
    i++; // Skip the next argument since we've consumed it
  }
}

// Install Devtron in development
if (isDevelopment) {
  // Devtron can be installed manually in DevTools console with: require('devtron').install()
  console.log('[Main] Development mode - Devtron can be installed in DevTools console');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 10, y: 10 }
    } : {})
  });

  if (isDevelopment) {
    await mainWindow.loadURL('http://localhost:4521');
    mainWindow.webContents.openDevTools();
    
    // Enable IPC debugging in development
    console.log('[Main] 🔍 IPC debugging enabled - check DevTools console for IPC call logs');
    
    // Log all IPC calls in main process
    const originalHandle = ipcMain.handle;
    ipcMain.handle = function(channel: string, listener: any) {
      const wrappedListener = async (event: any, ...args: any[]) => {
        if (channel.startsWith('stravu:')) {
          console.log(`[IPC] 📞 ${channel}`, args.length > 0 ? args : '(no args)');
        }
        const result = await listener(event, ...args);
        if (channel.startsWith('stravu:')) {
          console.log(`[IPC] 📤 ${channel} response:`, result);
        }
        return result;
      };
      return originalHandle.call(this, channel, wrappedListener);
    };
  } else {
    // Log the path we're trying to load
    const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
    console.log('Loading index.html from:', indexPath);

    try {
      await mainWindow.loadFile(indexPath);
    } catch (error) {
      console.error('Failed to load index.html:', error);
    }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log any console messages from the renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Skip messages that are already prefixed to avoid circular logging
    if (message.includes('[Main Process]') || message.includes('[Renderer]')) {
      return;
    }
    // Also skip Electron security warnings and other system messages
    if (message.includes('Electron Security Warning') || sourceId.includes('electron/js2c')) {
      return;
    }
    // Only log errors and warnings from renderer, not all messages
    if (level >= 2) { // 2 = warning, 3 = error
      console.log(`[Renderer] ${message} (${sourceId}:${line})`);
    }
  });

  // Override console methods to forward to renderer and logger
  console.log = (...args: any[]) => {
    // Format the message
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    // Write to logger if available
    if (logger) {
      logger.info(message);
    } else {
      originalLog.apply(console, args);
    }

    // Forward to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-log', 'log', message);
    }
  };

  console.error = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    // Extract Error object if present
    const errorObj = args.find(arg => arg instanceof Error) as Error | undefined;

    if (logger) {
      logger.error(message, errorObj);
    } else {
      originalError.apply(console, args);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-log', 'error', message);
    }
  };

  console.warn = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    // Extract Error object if present for warnings too
    const errorObj = args.find(arg => arg instanceof Error) as Error | undefined;

    if (logger) {
      logger.warn(message, errorObj);
    } else {
      originalWarn.apply(console, args);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-log', 'warn', message);
    }
  };

  console.info = (...args: any[]) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        if (arg instanceof Error) {
          return `Error: ${arg.message}\nStack: ${arg.stack}`;
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular structure
          return `[Object with circular structure: ${arg.constructor?.name || 'Object'}]`;
        }
      }
      return String(arg);
    }).join(' ');

    if (logger) {
      logger.info(message);
    } else {
      originalInfo.apply(console, args);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('main-log', 'info', message);
    }
  };

  // Log any renderer errors
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
  });
}

async function initializeServices() {
  // Store original console methods before any overrides
  originalLog = console.log;
  originalError = console.error;
  originalWarn = console.warn;
  originalInfo = console.info;

  configManager = new ConfigManager();
  await configManager.initialize();

  // Initialize logger early so it can capture all logs
  logger = new Logger(configManager);
  console.log('[Main] Logger initialized with file logging to ~/.crystal/logs');

  // Use the same database path as the original backend
  const dbPath = configManager.getDatabasePath();
  databaseService = new DatabaseService(dbPath);
  databaseService.initialize();

  sessionManager = new SessionManager(databaseService);
  sessionManager.initializeFromDatabase();

  // Start permission IPC server
  console.log('[Main] Initializing Permission IPC server...');
  permissionIpcServer = new PermissionIpcServer();
  console.log('[Main] Starting Permission IPC server...');

  let permissionIpcPath: string | null = null;
  try {
    await permissionIpcServer.start();
    permissionIpcPath = permissionIpcServer.getSocketPath();
    console.log('[Main] Permission IPC server started successfully');
    console.log('[Main] Permission IPC socket path:', permissionIpcPath);
  } catch (error) {
    console.error('[Main] Failed to start Permission IPC server:', error);
    console.error('[Main] Permission-based MCP will be disabled');
    permissionIpcServer = null;
  }

  // Create worktree manager without a specific path
  worktreeManager = new WorktreeManager();

  // Initialize the active project's worktree directory if one exists
  const activeProject = sessionManager.getActiveProject();
  if (activeProject) {
    await worktreeManager.initializeProject(activeProject.path);
  }

  const { ClaudeCodeManager } = await import('./services/claudeCodeManager');
  claudeCodeManager = new ClaudeCodeManager(sessionManager, logger, configManager, permissionIpcPath);
  gitDiffManager = new GitDiffManager();
  executionTracker = new ExecutionTracker(sessionManager, gitDiffManager);
  worktreeNameGenerator = new WorktreeNameGenerator(configManager);
  runCommandManager = new RunCommandManager(databaseService);
  
  // Initialize version checker
  versionChecker = new VersionChecker(configManager, logger);
  stravuAuthManager = new StravuAuthManager(logger);
  stravuNotebookService = new StravuNotebookService(stravuAuthManager, logger);

  taskQueue = new TaskQueue({
    sessionManager,
    worktreeManager,
    claudeCodeManager,
    gitDiffManager,
    executionTracker,
    worktreeNameGenerator
  });

  // Set up IPC event listeners for real-time updates
  setupEventListeners();
  
  // Start periodic version checking (only if enabled in settings)
  versionChecker.startPeriodicCheck();
}

app.whenReady().then(async () => {
  console.log('[Main] App is ready, initializing services...');
  await initializeServices();
  console.log('[Main] Services initialized, creating window...');
  await createWindow();
  console.log('[Main] Window created successfully');
  
  // Configure auto-updater
  setupAutoUpdater();
  
  // Check for updates after window is created
  setTimeout(async () => {
    console.log('[Main] Performing startup version check...');
    await versionChecker.checkOnStartup();
  }, 1000); // Small delay to ensure window is fully ready

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Main] Activating app, creating new window...');
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Close task queue
  if (taskQueue) {
    await taskQueue.close();
  }

  // Stop permission IPC server
  if (permissionIpcServer) {
    console.log('[Main] Stopping permission IPC server...');
    await permissionIpcServer.stop();
    console.log('[Main] Permission IPC server stopped');
  }
  
  // Stop version checker
  if (versionChecker) {
    versionChecker.stopPeriodicCheck();
  }

  // Close logger to ensure all logs are flushed
  if (logger) {
    logger.close();
  }
});

// Set up event listeners for real-time updates
function setupEventListeners() {
  // Listen to sessionManager events and broadcast to renderer
  sessionManager.on('session-created', (session) => {
    if (mainWindow) {
      mainWindow.webContents.send('session:created', session);
    }
  });

  sessionManager.on('session-updated', (session) => {
    if (mainWindow) {
      mainWindow.webContents.send('session:updated', session);
    }
  });

  sessionManager.on('session-deleted', (session) => {
    if (mainWindow) {
      mainWindow.webContents.send('session:deleted', session);
    }
  });

  sessionManager.on('sessions-loaded', (sessions) => {
    if (mainWindow) {
      mainWindow.webContents.send('sessions:loaded', sessions);
    }
  });

  sessionManager.on('session-output', (output) => {
    if (mainWindow) {
      mainWindow.webContents.send('session:output', output);
    }
  });

  // Listen to claudeCodeManager events
  claudeCodeManager.on('output', async (output: any) => {
    // Save raw output to database (including JSON)
    sessionManager.addSessionOutput(output.sessionId, {
      type: output.type,
      data: output.data,
      timestamp: output.timestamp
    });
    
    // Send real-time updates to renderer
    if (mainWindow) {
      if (output.type === 'json') {
        // For JSON, send both formatted output and raw JSON
        const { formatJsonForOutputEnhanced } = await import('./utils/toolFormatter');
        const formattedOutput = formatJsonForOutputEnhanced(output.data);
        if (formattedOutput) {
          // Send formatted as stdout for Output view
          mainWindow.webContents.send('session:output', {
            sessionId: output.sessionId,
            type: 'stdout',
            data: formattedOutput,
            timestamp: output.timestamp
          });
        }
        // Also send raw JSON for Messages view
        mainWindow.webContents.send('session:output', output);
      } else {
        // Send non-JSON outputs as-is
        mainWindow.webContents.send('session:output', output);
      }
    }
  });

  claudeCodeManager.on('spawned', async ({ sessionId }: { sessionId: string }) => {
    await sessionManager.updateSession(sessionId, { 
      status: 'running',
      run_started_at: new Date().toISOString()
    });
    
    // Start execution tracking
    try {
      const session = await sessionManager.getSession(sessionId);
      if (session && session.worktreePath) {
        // Get the latest prompt from prompt markers or use the session prompt
        const promptMarkers = sessionManager.getPromptMarkers(sessionId);
        const latestPrompt = promptMarkers.length > 0
          ? promptMarkers[promptMarkers.length - 1].prompt_text
          : session.prompt;

        await executionTracker.startExecution(sessionId, session.worktreePath, undefined, latestPrompt);

        // NOTE: Run commands are NOT started automatically when Claude spawns
        // They should only run when the user clicks the play button
      }
    } catch (error) {
      console.error(`Failed to start execution tracking for session ${sessionId}:`, error);
    }
  });

  claudeCodeManager.on('exit', async ({ sessionId, exitCode, signal }: { sessionId: string; exitCode: number; signal: string }) => {
    console.log(`Session ${sessionId} exited with code ${exitCode}, signal ${signal}`);
    await sessionManager.setSessionExitCode(sessionId, exitCode);
    await sessionManager.updateSession(sessionId, { status: 'stopped' });

    // Stop run commands
    try {
      runCommandManager.stopRunCommands(sessionId);
    } catch (error) {
      console.error(`Failed to stop run commands for session ${sessionId}:`, error);
    }

    // End execution tracking
    try {
      if (executionTracker.isTracking(sessionId)) {
        await executionTracker.endExecution(sessionId);
      }
    } catch (error) {
      console.error(`Failed to end execution tracking for session ${sessionId}:`, error);
    }
    
    // Add commit information when session ends
    try {
      const session = sessionManager.getSession(sessionId);
      if (session && session.worktreePath) {
        const timestamp = new Date().toLocaleTimeString();
        let commitInfo = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 📊 SESSION SUMMARY \x1b[0m\r\n\r\n`;
        
        // Check for uncommitted changes
        const statusOutput = execSync('git status --porcelain', { 
          cwd: session.worktreePath, 
          encoding: 'utf8' 
        }).trim();
        
        if (statusOutput) {
          const uncommittedFiles = statusOutput.split('\n').length;
          commitInfo += `\x1b[1m\x1b[33m⚠️  Uncommitted Changes:\x1b[0m ${uncommittedFiles} file${uncommittedFiles > 1 ? 's' : ''}\r\n`;
          
          // Show first few uncommitted files
          const filesToShow = statusOutput.split('\n').slice(0, 5);
          filesToShow.forEach(file => {
            const [status, ...nameParts] = file.trim().split(/\s+/);
            const fileName = nameParts.join(' ');
            commitInfo += `   \x1b[2m${status}\x1b[0m ${fileName}\r\n`;
          });
          
          if (uncommittedFiles > 5) {
            commitInfo += `   \x1b[2m... and ${uncommittedFiles - 5} more\x1b[0m\r\n`;
          }
          commitInfo += '\r\n';
        }
        
        // Get commit history for this branch
        const project = sessionManager.getProjectForSession(sessionId);
        const mainBranch = project?.main_branch || 'main';
        const commits = gitDiffManager.getCommitHistory(session.worktreePath, 10, mainBranch);
        
        if (commits.length > 0) {
          commitInfo += `\x1b[1m\x1b[32m📝 Commits in this session:\x1b[0m\r\n`;
          commits.forEach((commit, index) => {
            const shortHash = commit.hash.substring(0, 7);
            const date = commit.date.toLocaleString();
            const stats = commit.stats;
            commitInfo += `\r\n  \x1b[1m${index + 1}.\x1b[0m \x1b[33m${shortHash}\x1b[0m - ${commit.message}\r\n`;
            commitInfo += `     \x1b[2mby ${commit.author} on ${date}\x1b[0m\r\n`;
            if (stats.filesChanged > 0) {
              commitInfo += `     \x1b[32m+${stats.additions}\x1b[0m \x1b[31m-${stats.deletions}\x1b[0m (${stats.filesChanged} file${stats.filesChanged > 1 ? 's' : ''})\r\n`;
            }
          });
        } else if (!statusOutput) {
          commitInfo += `\x1b[2mNo commits were made in this session.\x1b[0m\r\n`;
        }
        
        commitInfo += `\r\n\x1b[2m─────────────────────────────────────────\x1b[0m\r\n`;
        
        // Add this summary to the session output
        sessionManager.addSessionOutput(sessionId, {
          type: 'stdout',
          data: commitInfo,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Failed to generate session summary for ${sessionId}:`, error);
    }
  });

  claudeCodeManager.on('error', async ({ sessionId, error }: { sessionId: string; error: string }) => {
    console.log(`Session ${sessionId} encountered an error: ${error}`);
    await sessionManager.updateSession(sessionId, { status: 'error', error });

    // Stop run commands on error
    try {
      runCommandManager.stopRunCommands(sessionId);
    } catch (stopError) {
      console.error(`Failed to stop run commands for session ${sessionId}:`, stopError);
    }

    // Cancel execution tracking on error
    try {
      if (executionTracker.isTracking(sessionId)) {
        executionTracker.cancelExecution(sessionId);
      }
    } catch (trackingError) {
      console.error(`Failed to cancel execution tracking for session ${sessionId}:`, trackingError);
    }
    
    // Add commit information when session errors
    try {
      const session = sessionManager.getSession(sessionId);
      if (session && session.worktreePath) {
        const timestamp = new Date().toLocaleTimeString();
        let commitInfo = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[41m\x1b[37m 📊 SESSION SUMMARY (ERROR) \x1b[0m\r\n\r\n`;
        
        // Check for uncommitted changes
        const statusOutput = execSync('git status --porcelain', { 
          cwd: session.worktreePath, 
          encoding: 'utf8' 
        }).trim();
        
        if (statusOutput) {
          const uncommittedFiles = statusOutput.split('\n').length;
          commitInfo += `\x1b[1m\x1b[33m⚠️  Uncommitted Changes:\x1b[0m ${uncommittedFiles} file${uncommittedFiles > 1 ? 's' : ''}\r\n`;
          
          // Show first few uncommitted files
          const filesToShow = statusOutput.split('\n').slice(0, 5);
          filesToShow.forEach(file => {
            const [status, ...nameParts] = file.trim().split(/\s+/);
            const fileName = nameParts.join(' ');
            commitInfo += `   \x1b[2m${status}\x1b[0m ${fileName}\r\n`;
          });
          
          if (uncommittedFiles > 5) {
            commitInfo += `   \x1b[2m... and ${uncommittedFiles - 5} more\x1b[0m\r\n`;
          }
          commitInfo += '\r\n';
        }
        
        // Get commit history for this branch
        const project = sessionManager.getProjectForSession(sessionId);
        const mainBranch = project?.main_branch || 'main';
        const commits = gitDiffManager.getCommitHistory(session.worktreePath, 10, mainBranch);
        
        if (commits.length > 0) {
          commitInfo += `\x1b[1m\x1b[32m📝 Commits before error:\x1b[0m\r\n`;
          commits.forEach((commit, index) => {
            const shortHash = commit.hash.substring(0, 7);
            const date = commit.date.toLocaleString();
            const stats = commit.stats;
            commitInfo += `\r\n  \x1b[1m${index + 1}.\x1b[0m \x1b[33m${shortHash}\x1b[0m - ${commit.message}\r\n`;
            commitInfo += `     \x1b[2mby ${commit.author} on ${date}\x1b[0m\r\n`;
            if (stats.filesChanged > 0) {
              commitInfo += `     \x1b[32m+${stats.additions}\x1b[0m \x1b[31m-${stats.deletions}\x1b[0m (${stats.filesChanged} file${stats.filesChanged > 1 ? 's' : ''})\r\n`;
            }
          });
        } else if (!statusOutput) {
          commitInfo += `\x1b[2mNo commits were made before the error.\x1b[0m\r\n`;
        }
        
        commitInfo += `\r\n\x1b[2m─────────────────────────────────────────\x1b[0m\r\n`;
        
        // Add this summary to the session output
        sessionManager.addSessionOutput(sessionId, {
          type: 'stdout',
          data: commitInfo,
          timestamp: new Date()
        });
      }
    } catch (summaryError) {
      console.error(`Failed to generate session summary for ${sessionId}:`, summaryError);
    }
  });

  // Listen to script output events
  sessionManager.on('script-output', (output) => {
    // Broadcast script output to renderer
    if (mainWindow) {
      mainWindow.webContents.send('script:output', output);
    }
  });

  // Listen to run command manager events
  runCommandManager.on('output', (output) => {
    // Store run command output with the session's script output
    if (output.sessionId && output.data) {
      sessionManager.addScriptOutput(output.sessionId, output.data);
    }
  });

  runCommandManager.on('error', (error) => {
    console.error(`Run command error for session ${error.sessionId}:`, error.error);
    // Add error to script output
    if (error.sessionId) {
      sessionManager.addScriptOutput(error.sessionId, `\n[Error] ${error.displayName}: ${error.error}\n`);
    }
  });

  runCommandManager.on('exit', (info) => {
    console.log(`Run command exited: ${info.displayName}, exitCode: ${info.exitCode}`);
    // Add exit info to script output
    if (info.sessionId && info.exitCode !== 0) {
      sessionManager.addScriptOutput(info.sessionId, `\n[Exit] ${info.displayName} exited with code ${info.exitCode}\n`);
    }
  });

  // Listen for version update events
  process.on('version-update-available', (versionInfo: VersionInfo) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Only send to renderer for custom dialog - no native dialogs
      mainWindow.webContents.send('version:update-available', versionInfo);
    }
  });
}

// Set up auto-updater
function setupAutoUpdater() {
  // Only setup auto-updater for packaged apps (not development)
  if (!app.isPackaged && !process.env.TEST_UPDATES) {
    console.log('[AutoUpdater] App is not packaged, skipping auto-updater setup');
    return;
  }

  // TEST MODE: Use local server for testing
  if (process.env.TEST_UPDATES === 'true') {
    const { setupTestUpdater } = require('./test-updater');
    setupTestUpdater();
    console.log('[AutoUpdater] Using test update server at:', process.env.UPDATE_SERVER_URL || 'http://localhost:8080');
  } else {
    // Configure electron-updater for production
    autoUpdater.autoDownload = false; // We'll manually trigger downloads
    autoUpdater.autoInstallOnAppQuit = true;
    
    // The publish configuration in package.json will be used automatically
    // No need to manually set feed URL with electron-updater
  }

  // Error handling
  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:error', {
        message: error.message,
        stack: error.stack
      });
    }
  });

  // Update checking
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:checking-for-update');
    }
  });

  // Update available
  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:update-available', info);
    }
  });

  // No update available
  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] No update available:', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:update-not-available', info);
    }
  });

  // Download progress
  autoUpdater.on('download-progress', (progressInfo) => {
    console.log('[AutoUpdater] Download progress:', progressInfo.percent);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:download-progress', progressInfo);
    }
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:update-downloaded', info);
      // Let the renderer handle the UI - no native dialog
    }
  });
}

// Basic app info handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('is-packaged', () => {
  return app.isPackaged;
});

// Version checking handlers
ipcMain.handle('version:check-for-updates', async () => {
  try {
    const versionInfo = await versionChecker.checkForUpdates();
    return { success: true, data: versionInfo };
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return { success: false, error: 'Failed to check for updates' };
  }
});

ipcMain.handle('version:get-info', () => {
  try {
    return { 
      success: true, 
      data: { 
        current: app.getVersion(),
        name: app.getName()
      } 
    };
  } catch (error) {
    console.error('Failed to get version info:', error);
    return { success: false, error: 'Failed to get version info' };
  }
});

// Auto-updater handlers
ipcMain.handle('updater:check-and-download', async () => {
  try {
    if (!app.isPackaged && !process.env.TEST_UPDATES) {
      return { success: false, error: 'Auto-update is only available in packaged apps' };
    }
    
    // Check for updates using autoUpdater
    const result = await autoUpdater.checkForUpdatesAndNotify();
    
    return { success: true, message: 'Checking for updates...', data: result };
  } catch (error) {
    console.error('Failed to check for updates with autoUpdater:', error);
    return { success: false, error: 'Failed to check for updates' };
  }
});

ipcMain.handle('updater:download-update', async () => {
  try {
    if (!app.isPackaged && !process.env.TEST_UPDATES) {
      return { success: false, error: 'Auto-update is only available in packaged apps' };
    }
    
    // Start downloading the update
    const result = await autoUpdater.downloadUpdate();
    
    return { success: true, message: 'Downloading update...', data: result };
  } catch (error) {
    console.error('Failed to download update:', error);
    return { success: false, error: 'Failed to download update' };
  }
});

ipcMain.handle('updater:install-update', () => {
  try {
    if (!app.isPackaged && !process.env.TEST_UPDATES) {
      return { success: false, error: 'Auto-update is only available in packaged apps' };
    }
    
    // Quit and install the update
    autoUpdater.quitAndInstall(false, true);
    
    return { success: true, message: 'Installing update...' };
  } catch (error) {
    console.error('Failed to install update:', error);
    return { success: false, error: 'Failed to install update' };
  }
});

// Session management handlers
ipcMain.handle('sessions:get-all', async () => {
  try {
    const sessions = await sessionManager.getAllSessions();
    return { success: true, data: sessions };
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return { success: false, error: 'Failed to get sessions' };
  }
});

ipcMain.handle('sessions:get', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    return { success: true, data: session };
  } catch (error) {
    console.error('Failed to get session:', error);
    return { success: false, error: 'Failed to get session' };
  }
});

ipcMain.handle('sessions:get-all-with-projects', async () => {
  try {
    const allProjects = databaseService.getAllProjects();
    const projectsWithSessions = allProjects.map(project => {
      const sessions = sessionManager.getSessionsForProject(project.id);
      return {
        ...project,
        sessions
      };
    });
    return { success: true, data: projectsWithSessions };
  } catch (error) {
    console.error('Failed to get sessions with projects:', error);
    return { success: false, error: 'Failed to get sessions with projects' };
  }
});

ipcMain.handle('sessions:create', async (_event, request: CreateSessionRequest) => {
  console.log('[IPC] sessions:create handler called with request:', request);
  try {
    let targetProject;
    
    if (request.projectId) {
      // Use the project specified in the request
      targetProject = databaseService.getProject(request.projectId);
      if (!targetProject) {
        return { success: false, error: 'Project not found' };
      }
    } else {
      // Fall back to active project for backward compatibility
      targetProject = sessionManager.getActiveProject();
      if (!targetProject) {
        console.warn('[IPC] No project specified and no active project found');
        return { success: false, error: 'No project specified. Please provide a projectId.' };
      }
    }

    if (!taskQueue) {
      console.error('[IPC] Task queue not initialized');
      return { success: false, error: 'Task queue not initialized' };
    }

    const count = request.count || 1;
    console.log(`[IPC] Creating ${count} session(s) with prompt: "${request.prompt}"`);

    if (count > 1) {
      console.log('[IPC] Creating multiple sessions...');
      const jobs = await taskQueue.createMultipleSessions(request.prompt, request.worktreeTemplate || '', count, request.permissionMode, targetProject.id);
      console.log(`[IPC] Created ${jobs.length} jobs:`, jobs.map(job => job.id));
      return { success: true, data: { jobIds: jobs.map(job => job.id) } };
    } else {
      console.log('[IPC] Creating single session...');
      const job = await taskQueue.createSession({
        prompt: request.prompt,
        worktreeTemplate: request.worktreeTemplate || '',
        permissionMode: request.permissionMode,
        projectId: targetProject.id
      });
      console.log('[IPC] Created job with ID:', job.id);
      return { success: true, data: { jobId: job.id } };
    }
  } catch (error) {
    console.error('[IPC] Failed to create session:', error);
    console.error('[IPC] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Extract detailed error information
    let errorMessage = 'Failed to create session';
    let errorDetails = '';
    let command = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || error.toString();

      // Check if it's a git command error
      const gitError = error as any;
      if (gitError.gitCommand) {
        command = gitError.gitCommand;
      } else if (gitError.cmd) {
        command = gitError.cmd;
      }

      // Include git output if available
      if (gitError.gitOutput) {
        errorDetails = gitError.gitOutput;
      } else if (gitError.stderr) {
        errorDetails = gitError.stderr;
      }
    }

    return {
      success: false,
      error: errorMessage,
      details: errorDetails,
      command: command
    };
  }
});

ipcMain.handle('sessions:delete', async (_event, sessionId: string) => {
  try {
    // Get database session details before archiving (includes worktree_name and project_id)
    const dbSession = databaseService.getSession(sessionId);
    if (!dbSession) {
      return { success: false, error: 'Session not found' };
    }

    // Add a message to session output about archiving
    const timestamp = new Date().toLocaleTimeString();
    let archiveMessage = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 📦 ARCHIVING SESSION \x1b[0m\r\n`;

    // Clean up the worktree if session has one (but not for main repo sessions)
    if (dbSession.worktree_name && dbSession.project_id && !dbSession.is_main_repo) {
      const project = databaseService.getProject(dbSession.project_id);
      if (project) {
        try {
          console.log(`[Main] Removing worktree ${dbSession.worktree_name} for session ${sessionId}`);
          archiveMessage += `\x1b[90mRemoving git worktree: ${dbSession.worktree_name}\x1b[0m\r\n`;
          
          await worktreeManager.removeWorktree(project.path, dbSession.worktree_name);
          
          console.log(`[Main] Successfully removed worktree ${dbSession.worktree_name}`);
          archiveMessage += `\x1b[32m✓ Worktree removed successfully\x1b[0m\r\n`;
        } catch (worktreeError) {
          // Log the error but don't fail the session deletion
          console.error(`[Main] Failed to remove worktree ${dbSession.worktree_name}:`, worktreeError);
          archiveMessage += `\x1b[33m⚠ Failed to remove worktree (manual cleanup may be needed)\x1b[0m\r\n`;
          // Continue with session deletion even if worktree removal fails
        }
      }
    }

    archiveMessage += `\x1b[90mSession archived. It will no longer appear in the active sessions list.\x1b[0m\r\n\r\n`;
    
    // Add the archive message to session output
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: archiveMessage,
      timestamp: new Date()
    });

    // Archive the session
    await sessionManager.archiveSession(sessionId);

    return { success: true };
  } catch (error) {
    console.error('Failed to delete session:', error);
    return { success: false, error: 'Failed to delete session' };
  }
});

ipcMain.handle('sessions:input', async (_event, sessionId: string, input: string) => {
  try {
    // Store user input in session outputs for persistence
    const userInputDisplay = `> ${input.trim()}\n`;
    await sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: userInputDisplay,
      timestamp: new Date()
    });

    claudeCodeManager.sendInput(sessionId, input);
    return { success: true };
  } catch (error) {
    console.error('Failed to send input:', error);
    return { success: false, error: 'Failed to send input' };
  }
});

ipcMain.handle('sessions:get-or-create-main-repo', async (_event, projectId: number) => {
  try {
    console.log('[IPC] sessions:get-or-create-main-repo handler called with projectId:', projectId);
    
    // Get or create the main repo session
    const session = sessionManager.getOrCreateMainRepoSession(projectId);
    
    // If it's a newly created session, just emit the created event
    const dbSession = databaseService.getSession(session.id);
    if (dbSession && dbSession.status === 'pending') {
      console.log('[IPC] New main repo session created:', session.id);
      
      // Emit session created event
      sessionManager.emitSessionCreated(session);
      
      // Set the status to stopped since Claude Code isn't running yet
      sessionManager.updateSession(session.id, { status: 'stopped' });
    }
    
    return { success: true, data: session };
  } catch (error) {
    console.error('Failed to get or create main repo session:', error);
    return { success: false, error: 'Failed to get or create main repo session' };
  }
});

ipcMain.handle('sessions:continue', async (_event, sessionId: string, prompt?: string) => {
  try {
    // Get session details
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get conversation history
    const conversationHistory = sessionManager.getConversationMessages(sessionId);

    // If no prompt provided, use empty string (for resuming)
    const continuePrompt = prompt || '';
    
    // Check if this is a main repo session that hasn't started Claude Code yet
    const dbSession = databaseService.getSession(sessionId);
    const isMainRepoFirstStart = dbSession?.is_main_repo && conversationHistory.length === 0 && continuePrompt;
    
    // Update session status to initializing and clear run_started_at
    sessionManager.updateSession(sessionId, { 
      status: 'initializing',
      run_started_at: null // Clear previous run time
    });
    
    if (isMainRepoFirstStart && continuePrompt) {
      // First message in main repo session - start Claude Code without --continue
      console.log(`[IPC] Starting Claude Code for main repo session ${sessionId} with first prompt`);
      
      // Add initial prompt marker
      sessionManager.addInitialPromptMarker(sessionId, continuePrompt);
      
      // Add initial prompt to conversation messages
      sessionManager.addConversationMessage(sessionId, 'user', continuePrompt);
      
      // Add the prompt to output so it's visible
      const timestamp = new Date().toLocaleTimeString();
      const initialPromptDisplay = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[42m\x1b[30m 👤 USER PROMPT \x1b[0m\r\n` +
                                   `\x1b[1m\x1b[92m${continuePrompt}\x1b[0m\r\n\r\n`;
      await sessionManager.addSessionOutput(sessionId, {
        type: 'stdout',
        data: initialPromptDisplay,
        timestamp: new Date()
      });
      
      // Run build script if configured
      const project = dbSession?.project_id ? databaseService.getProject(dbSession.project_id) : null;
      if (project?.build_script) {
        console.log(`[IPC] Running build script for main repo session ${sessionId}`);
        
        const buildWaitingMessage = `\x1b[36m[${new Date().toLocaleTimeString()}]\x1b[0m \x1b[1m\x1b[33m⏳ Waiting for build script to complete...\x1b[0m\r\n\r\n`;
        await sessionManager.addSessionOutput(sessionId, {
          type: 'stdout',
          data: buildWaitingMessage,
          timestamp: new Date()
        });
        
        const buildCommands = project.build_script.split('\n').filter(cmd => cmd.trim());
        const buildResult = await sessionManager.runBuildScript(sessionId, buildCommands, session.worktreePath);
        console.log(`[IPC] Build script completed. Success: ${buildResult.success}`);
      }
      
      // Start Claude Code with the user's prompt
      await claudeCodeManager.startSession(sessionId, session.worktreePath, continuePrompt, dbSession?.permission_mode);
    } else {
      // Normal continue for existing sessions
      if (continuePrompt) {
        sessionManager.continueConversation(sessionId, continuePrompt);
      }
      
      // Continue the session with the existing conversation
      await claudeCodeManager.continueSession(sessionId, session.worktreePath, continuePrompt, conversationHistory);
    }

    // The session manager will update status based on Claude output
    return { success: true };
  } catch (error) {
    console.error('Failed to continue conversation:', error);
    return { success: false, error: 'Failed to continue conversation' };
  }
});

ipcMain.handle('sessions:get-output', async (_event, sessionId: string) => {
  try {
    console.log(`[IPC] sessions:get-output called for session: ${sessionId}`);
    const outputs = await sessionManager.getSessionOutputs(sessionId);
    console.log(`[IPC] Retrieved ${outputs.length} outputs for session ${sessionId}`);
    
    // Transform JSON messages to formatted stdout on the fly
    const { formatJsonForOutputEnhanced } = await import('./utils/toolFormatter');
    const transformedOutputs = outputs.map(output => {
      if (output.type === 'json') {
        // Generate formatted output from JSON
        const outputText = formatJsonForOutputEnhanced(output.data);
        if (outputText) {
          // Return as stdout for the Output view
          return {
            ...output,
            type: 'stdout' as const,
            data: outputText
          };
        }
        // If no output format can be generated, skip this JSON message
        return null;
      }
      return output; // Non-JSON outputs pass through
    }).filter(Boolean); // Remove any null entries
    return { success: true, data: transformedOutputs };
  } catch (error) {
    console.error('Failed to get session outputs:', error);
    return { success: false, error: 'Failed to get session outputs' };
  }
});

ipcMain.handle('sessions:get-conversation', async (_event, sessionId: string) => {
  try {
    const messages = await sessionManager.getConversationMessages(sessionId);
    return { success: true, data: messages };
  } catch (error) {
    console.error('Failed to get conversation messages:', error);
    return { success: false, error: 'Failed to get conversation messages' };
  }
});

ipcMain.handle('sessions:mark-viewed', async (_event, sessionId: string) => {
  try {
    await sessionManager.markSessionAsViewed(sessionId);
    return { success: true };
  } catch (error) {
    console.error('Failed to mark session as viewed:', error);
    return { success: false, error: 'Failed to mark session as viewed' };
  }
});

ipcMain.handle('sessions:stop', async (_event, sessionId: string) => {
  try {
    await claudeCodeManager.stopSession(sessionId);
    return { success: true };
  } catch (error) {
    console.error('Failed to stop session:', error);
    return { success: false, error: 'Failed to stop session' };
  }
});

ipcMain.handle('sessions:generate-name', async (_event, prompt: string) => {
  try {
    const name = await worktreeNameGenerator.generateWorktreeName(prompt);
    return { success: true, data: name };
  } catch (error) {
    console.error('Failed to generate session name:', error);
    return { success: false, error: 'Failed to generate session name' };
  }
});

// Git and execution handlers
ipcMain.handle('sessions:get-executions', async (_event, sessionId: string) => {
  try {
    // Get session to find worktree path
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    // Get git commit history from the worktree
    const project = sessionManager.getProjectForSession(sessionId);
    const mainBranch = project?.main_branch || 'main';
    const commits = gitDiffManager.getCommitHistory(session.worktreePath, 50, mainBranch);

    // Check for uncommitted changes
    const uncommittedDiff = await gitDiffManager.captureWorkingDirectoryDiff(session.worktreePath);
    const hasUncommittedChanges = uncommittedDiff.stats.filesChanged > 0;

    // Transform commits to execution diff format for compatibility
    const executions: any[] = commits.map((commit, index) => ({
      id: index + 1,
      session_id: sessionId,
      prompt_text: commit.message,
      execution_sequence: index + 1,
      git_diff: null, // Will be loaded on demand
      files_changed: [],
      stats_additions: commit.stats.additions,
      stats_deletions: commit.stats.deletions,
      stats_files_changed: commit.stats.filesChanged,
      before_commit_hash: `${commit.hash}~1`,
      after_commit_hash: commit.hash,
      timestamp: commit.date.toISOString()
    }));

    // Add uncommitted changes as the first item if they exist
    if (hasUncommittedChanges) {
      executions.unshift({
        id: 0, // Special ID for uncommitted changes
        session_id: sessionId,
        prompt_text: 'Uncommitted changes',
        execution_sequence: 0,
        git_diff: null,
        files_changed: uncommittedDiff.changedFiles || [],
        stats_additions: uncommittedDiff.stats.additions,
        stats_deletions: uncommittedDiff.stats.deletions,
        stats_files_changed: uncommittedDiff.stats.filesChanged,
        before_commit_hash: commits.length > 0 ? commits[0].hash : 'HEAD',
        after_commit_hash: 'UNCOMMITTED',
        timestamp: new Date().toISOString()
      });
    }

    return { success: true, data: executions };
  } catch (error) {
    console.error('Failed to get executions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get executions';
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('sessions:get-execution-diff', async (_event, sessionId: string, executionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    // Get git commit history
    const project = sessionManager.getProjectForSession(sessionId);
    const mainBranch = project?.main_branch || 'main';
    const commits = gitDiffManager.getCommitHistory(session.worktreePath, 50, mainBranch);
    const executionIndex = parseInt(executionId) - 1;

    if (executionIndex < 0 || executionIndex >= commits.length) {
      return { success: false, error: 'Invalid execution ID' };
    }

    // Get diff for the specific commit
    const commit = commits[executionIndex];
    const diff = gitDiffManager.getCommitDiff(session.worktreePath, commit.hash);
    return { success: true, data: diff };
  } catch (error) {
    console.error('Failed to get execution diff:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get execution diff';
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('sessions:git-commit', async (_event, sessionId: string, message: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    // For now, we don't have a commitChanges method - would need to implement
    // await gitDiffManager.commitChanges(session.worktreePath, message);
    return { success: false, error: 'Git commit not implemented yet' };
  } catch (error) {
    console.error('Failed to commit changes:', error);
    return { success: false, error: 'Failed to commit changes' };
  }
});

ipcMain.handle('sessions:git-diff', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    const diff = await gitDiffManager.getGitDiff(session.worktreePath);
    return { success: true, data: diff };
  } catch (error) {
    console.error('Failed to get git diff:', error);
    return { success: false, error: 'Failed to get git diff' };
  }
});

// Configuration handlers
ipcMain.handle('config:get', async () => {
  try {
    const config = configManager.getConfig();
    return { success: true, data: config };
  } catch (error) {
    console.error('Failed to get config:', error);
    return { success: false, error: 'Failed to get config' };
  }
});

ipcMain.handle('config:update', async (_event, updates: any) => {
  try {
    await configManager.updateConfig(updates);
    return { success: true };
  } catch (error) {
    console.error('Failed to update config:', error);
    return { success: false, error: 'Failed to update config' };
  }
});

// Dialog handlers
ipcMain.handle('dialog:open-file', async (_event, options?: Electron.OpenDialogOptions) => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'No main window available' };
    }

    const defaultOptions: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      ...options
    };

    const result = await dialog.showOpenDialog(mainWindow, defaultOptions);

    if (result.canceled) {
      return { success: true, data: null };
    }

    return { success: true, data: result.filePaths[0] };
  } catch (error) {
    console.error('Failed to open file dialog:', error);
    return { success: false, error: 'Failed to open file dialog' };
  }
});

ipcMain.handle('dialog:open-directory', async (_event, options?: Electron.OpenDialogOptions) => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'No main window available' };
    }

    const defaultOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      ...options
    };

    const result = await dialog.showOpenDialog(mainWindow, defaultOptions);

    if (result.canceled) {
      return { success: true, data: null };
    }

    return { success: true, data: result.filePaths[0] };
  } catch (error) {
    console.error('Failed to open directory dialog:', error);
    return { success: false, error: 'Failed to open directory dialog' };
  }
});

// Project handlers
ipcMain.handle('projects:get-all', async () => {
  try {
    const projects = databaseService.getAllProjects();
    return { success: true, data: projects };
  } catch (error) {
    console.error('Failed to get projects:', error);
    return { success: false, error: 'Failed to get projects' };
  }
});

ipcMain.handle('projects:get-active', async () => {
  try {
    const activeProject = sessionManager.getActiveProject();
    return { success: true, data: activeProject };
  } catch (error) {
    console.error('Failed to get active project:', error);
    return { success: false, error: 'Failed to get active project' };
  }
});

ipcMain.handle('projects:create', async (_event, projectData: any) => {
  try {
    console.log('[Main] Creating project:', projectData);

    // Import fs and exec utilities
    const { mkdirSync, existsSync } = require('fs');
    const { execSync: nodeExecSync } = require('child_process');

    // Create directory if it doesn't exist
    if (!existsSync(projectData.path)) {
      console.log('[Main] Creating directory:', projectData.path);
      mkdirSync(projectData.path, { recursive: true });
    }

    // Check if it's a git repository
    let isGitRepo = false;
    try {
      nodeExecSync(`cd "${projectData.path}" && git rev-parse --is-inside-work-tree`, { encoding: 'utf-8' });
      isGitRepo = true;
      console.log('[Main] Directory is already a git repository');
    } catch (error) {
      console.log('[Main] Directory is not a git repository, initializing...');
    }

    // Initialize git if needed
    if (!isGitRepo) {
      try {
        // Use the specified main branch name if provided
        const branchName = projectData.mainBranch || 'main';

        nodeExecSync(`cd "${projectData.path}" && git init`, { encoding: 'utf-8' });
        console.log('[Main] Git repository initialized successfully');

        // Create and checkout the specified branch
        nodeExecSync(`cd "${projectData.path}" && git checkout -b ${branchName}`, { encoding: 'utf-8' });
        console.log(`[Main] Created and checked out branch: ${branchName}`);

        // Create initial commit
        nodeExecSync(`cd "${projectData.path}" && git commit -m "Initial commit" --allow-empty`, { encoding: 'utf-8' });
        console.log('[Main] Created initial empty commit');
      } catch (error) {
        console.error('[Main] Failed to initialize git repository:', error);
        // Continue anyway - let the user handle git setup manually if needed
      }
    }

    // Detect or use the provided main branch
    let mainBranch: string | undefined = projectData.mainBranch;
    if (!mainBranch && isGitRepo) {
      try {
        mainBranch = await worktreeManager.detectMainBranch(projectData.path);
        console.log('[Main] Detected main branch:', mainBranch);
      } catch (error) {
        console.log('[Main] Could not detect main branch, skipping:', error);
        // Not a git repository or error detecting, that's okay
      }
    }

    const project = databaseService.createProject(
      projectData.name,
      projectData.path,
      projectData.systemPrompt,
      projectData.runScript,
      mainBranch,
      projectData.buildScript,
      undefined, // default_permission_mode
      projectData.openIdeCommand
    );

    // If run_script was provided, also create run commands
    if (projectData.runScript && project) {
      const commands = projectData.runScript.split('\n').filter((cmd: string) => cmd.trim());
      commands.forEach((command: string, index: number) => {
        databaseService.createRunCommand(
          project.id,
          command.trim(),
          `Command ${index + 1}`,
          index
        );
      });
    }

    console.log('[Main] Project created successfully:', project);
    return { success: true, data: project };
  } catch (error) {
    console.error('[Main] Failed to create project:', error);

    // Extract detailed error information
    let errorMessage = 'Failed to create project';
    let errorDetails = '';
    let command = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || error.toString();

      // Check if it's a command error
      const cmdError = error as any;
      if (cmdError.cmd) {
        command = cmdError.cmd;
      }

      // Include command output if available
      if (cmdError.stderr) {
        errorDetails = cmdError.stderr;
      } else if (cmdError.stdout) {
        errorDetails = cmdError.stdout;
      }
    }

    return {
      success: false,
      error: errorMessage,
      details: errorDetails,
      command: command
    };
  }
});

ipcMain.handle('projects:activate', async (_event, projectId: string) => {
  try {
    const project = databaseService.setActiveProject(parseInt(projectId));
    if (project) {
      sessionManager.setActiveProject(project);
      await worktreeManager.initializeProject(project.path);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to activate project:', error);
    return { success: false, error: 'Failed to activate project' };
  }
});

ipcMain.handle('projects:update', async (_event, projectId: string, updates: any) => {
  try {
    // Update the project
    const project = databaseService.updateProject(parseInt(projectId), updates);

    // If run_script was updated, also update the run commands table
    if (updates.run_script !== undefined) {
      const projectIdNum = parseInt(projectId);

      // Delete existing run commands
      databaseService.deleteProjectRunCommands(projectIdNum);

      // Add new run commands from the multiline script
      if (updates.run_script) {
        const commands = updates.run_script.split('\n').filter((cmd: string) => cmd.trim());
        commands.forEach((command: string, index: number) => {
          databaseService.createRunCommand(
            projectIdNum,
            command.trim(),
            `Command ${index + 1}`,
            index
          );
        });
      }
    }

    return { success: true, data: project };
  } catch (error) {
    console.error('Failed to update project:', error);
    return { success: false, error: 'Failed to update project' };
  }
});

ipcMain.handle('projects:delete', async (_event, projectId: string) => {
  try {
    const success = databaseService.deleteProject(parseInt(projectId));
    return { success: true, data: success };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return { success: false, error: 'Failed to delete project' };
  }
});

ipcMain.handle('projects:detect-branch', async (_event, path: string) => {
  try {
    const branch = await worktreeManager.detectMainBranch(path);
    return { success: true, data: branch };
  } catch (error) {
    console.log('[Main] Could not detect branch:', error);
    return { success: true, data: 'main' }; // Return default if detection fails
  }
});

// Script execution handlers
ipcMain.handle('sessions:has-run-script', async (_event, sessionId: string) => {
  try {
    const runScript = sessionManager.getProjectRunScript(sessionId);
    return { success: true, data: !!runScript };
  } catch (error) {
    console.error('Failed to check run script:', error);
    return { success: false, error: 'Failed to check run script' };
  }
});

ipcMain.handle('sessions:get-running-session', async () => {
  try {
    const runningSessionId = sessionManager.getCurrentRunningSessionId();
    return { success: true, data: runningSessionId };
  } catch (error) {
    console.error('Failed to get running session:', error);
    return { success: false, error: 'Failed to get running session' };
  }
});

ipcMain.handle('sessions:run-script', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    const commands = sessionManager.getProjectRunScript(sessionId);
    if (!commands) {
      return { success: false, error: 'No run script configured for this project' };
    }

    sessionManager.runScript(sessionId, commands, session.worktreePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to run script:', error);
    return { success: false, error: 'Failed to run script' };
  }
});

ipcMain.handle('sessions:stop-script', async () => {
  try {
    sessionManager.stopRunningScript();
    return { success: true };
  } catch (error) {
    console.error('Failed to stop script:', error);
    return { success: false, error: 'Failed to stop script' };
  }
});

ipcMain.handle('sessions:run-terminal-command', async (_event, sessionId: string, command: string) => {
  try {
    await sessionManager.runTerminalCommand(sessionId, command);
    return { success: true };
  } catch (error) {
    console.error('Failed to run terminal command:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to run terminal command' };
  }
});

ipcMain.handle('sessions:resize-terminal', async (_event, sessionId: string, cols: number, rows: number) => {
  try {
    sessionManager.resizeTerminal(sessionId, cols, rows);
    return { success: true };
  } catch (error) {
    console.error('Failed to resize terminal:', error);
    return { success: false, error: 'Failed to resize terminal' };
  }
});

ipcMain.handle('sessions:get-prompts', async (_event, sessionId: string) => {
  try {
    const prompts = sessionManager.getSessionPrompts(sessionId);
    return { success: true, data: prompts };
  } catch (error) {
    console.error('Failed to get session prompts:', error);
    return { success: false, error: 'Failed to get session prompts' };
  }
});

ipcMain.handle('sessions:open-ide', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    const project = sessionManager.getProjectForSession(sessionId);
    if (!project || !project.open_ide_command) {
      return { success: false, error: 'No IDE command configured for this project' };
    }

    // Execute the IDE command in the worktree directory
    const { exec } = require('child_process');
    exec(project.open_ide_command, { cwd: session.worktreePath }, (error: Error | null) => {
      if (error) {
        console.error('Failed to open IDE:', error);
      } else {
        console.log('Successfully opened IDE for session:', sessionId);
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to open IDE:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to open IDE' };
  }
});

ipcMain.handle('sessions:get-combined-diff', async (_event, sessionId: string, executionIds?: number[]) => {
  try {
    // Get session to find worktree path
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    // Handle uncommitted changes request
    if (executionIds && executionIds.length === 1 && executionIds[0] === 0) {
      const uncommittedDiff = await gitDiffManager.captureWorkingDirectoryDiff(session.worktreePath);
      return { success: true, data: uncommittedDiff };
    }

    // Get git commit history
    const project = sessionManager.getProjectForSession(sessionId);
    const mainBranch = project?.main_branch || 'main';
    const commits = gitDiffManager.getCommitHistory(session.worktreePath, 50, mainBranch);

    if (!commits.length) {
      return {
        success: true,
        data: {
          diff: '',
          stats: { additions: 0, deletions: 0, filesChanged: 0 },
          changedFiles: []
        }
      };
    }

    // If we have a range selection (2 IDs), use git diff between them
    if (executionIds && executionIds.length === 2) {
      const sortedIds = [...executionIds].sort((a, b) => a - b);

      // Handle range that includes uncommitted changes
      if (sortedIds[0] === 0 || sortedIds[1] === 0) {
        // If uncommitted is in the range, get diff from the other commit to working directory
        const commitId = sortedIds[0] === 0 ? sortedIds[1] : sortedIds[0];
        const commitIndex = commitId - 1;

        if (commitIndex >= 0 && commitIndex < commits.length) {
          const fromCommit = commits[commitIndex];
          // Get diff from commit to working directory (includes uncommitted changes)
          const diff = execSync(
            `git diff ${fromCommit.hash}`,
            { cwd: session.worktreePath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
          );

          const stats = gitDiffManager.parseDiffStats(
            execSync(`git diff --stat ${fromCommit.hash}`, { cwd: session.worktreePath, encoding: 'utf8' })
          );

          const changedFiles = execSync(
            `git diff --name-only ${fromCommit.hash}`,
            { cwd: session.worktreePath, encoding: 'utf8' }
          ).trim().split('\n').filter(Boolean);

          return {
            success: true,
            data: {
              diff,
              stats,
              changedFiles,
              beforeHash: fromCommit.hash,
              afterHash: 'UNCOMMITTED'
            }
          };
        }
      }

      // For regular commit ranges, we want to show all changes introduced by the selected commits
      // - Commits are stored newest first (index 0 = newest)
      // - User selects from older to newer visually
      // - We need to go back one commit before the older selection to show all changes
      const newerIndex = sortedIds[0] - 1;   // Lower ID = newer commit
      const olderIndex = sortedIds[1] - 1;   // Higher ID = older commit

      if (newerIndex >= 0 && newerIndex < commits.length && olderIndex >= 0 && olderIndex < commits.length) {
        const newerCommit = commits[newerIndex]; // Newer commit
        const olderCommit = commits[olderIndex]; // Older commit

        // To show all changes introduced by the selected commits, we diff from
        // the parent of the older commit to the newer commit
        let fromCommitHash: string;

        try {
          // Try to get the parent of the older commit
          const parentHash = execSync(`git rev-parse ${olderCommit.hash}^`, {
            cwd: session.worktreePath,
            encoding: 'utf8'
          }).trim();
          fromCommitHash = parentHash;
        } catch (error) {
          // If there's no parent (initial commit), use git's empty tree hash
          fromCommitHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
        }

        // Use git diff to show all changes from before the range to the newest selected commit
        const diff = await gitDiffManager.captureCommitDiff(
          session.worktreePath,
          fromCommitHash,
          newerCommit.hash
        );
        return { success: true, data: diff };
      }
    }

    // If no specific execution IDs are provided, get diff from first to last commit
    if (!executionIds || executionIds.length === 0) {
      if (commits.length === 0) {
        return {
          success: true,
          data: {
            diff: '',
            stats: { additions: 0, deletions: 0, filesChanged: 0 },
            changedFiles: []
          }
        };
      }

      // For a single commit, show the commit's own changes
      if (commits.length === 1) {
        const diff = gitDiffManager.getCommitDiff(session.worktreePath, commits[0].hash);
        return { success: true, data: diff };
      }

      // For multiple commits, get diff from parent of first commit to HEAD (all changes)
      const firstCommit = commits[commits.length - 1]; // Oldest commit
      let fromCommitHash: string;

      try {
        // Try to get the parent of the first commit
        fromCommitHash = execSync(`git rev-parse ${firstCommit.hash}^`, {
          cwd: session.worktreePath,
          encoding: 'utf8'
        }).trim();
      } catch (error) {
        // If there's no parent (initial commit), use git's empty tree hash
        fromCommitHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
      }

      const diff = await gitDiffManager.captureCommitDiff(
        session.worktreePath,
        fromCommitHash,
        'HEAD'
      );
      return { success: true, data: diff };
    }

    // For multiple individual selections, we need to create a range from first to last
    if (executionIds.length > 2) {
      const sortedIds = [...executionIds].sort((a, b) => a - b);
      const firstId = sortedIds[sortedIds.length - 1]; // Highest ID = oldest commit
      const lastId = sortedIds[0]; // Lowest ID = newest commit

      const fromIndex = firstId - 1;
      const toIndex = lastId - 1;

      if (fromIndex >= 0 && fromIndex < commits.length && toIndex >= 0 && toIndex < commits.length) {
        const fromCommit = commits[fromIndex]; // Oldest selected
        const toCommit = commits[toIndex]; // Newest selected

        const diff = await gitDiffManager.captureCommitDiff(
          session.worktreePath,
          fromCommit.hash,
          toCommit.hash
        );
        return { success: true, data: diff };
      }
    }

    // Single commit selection
    if (executionIds.length === 1) {
      const commitIndex = executionIds[0] - 1;
      if (commitIndex >= 0 && commitIndex < commits.length) {
        const commit = commits[commitIndex];
        const diff = gitDiffManager.getCommitDiff(session.worktreePath, commit.hash);
        return { success: true, data: diff };
      }
    }

    // Fallback to empty diff
    return {
      success: true,
      data: {
        diff: '',
        stats: { additions: 0, deletions: 0, filesChanged: 0 },
        changedFiles: []
      }
    };
  } catch (error) {
    console.error('Failed to get combined diff:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get combined diff';
    return { success: false, error: errorMessage };
  }
});

// Git rebase operations
ipcMain.handle('sessions:rebase-main-into-worktree', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.worktreePath) {
      return { success: false, error: 'Session has no worktree path' };
    }

    // Get the project to find the main branch
    const project = sessionManager.getProjectForSession(sessionId);
    if (!project) {
      return { success: false, error: 'Project not found for session' };
    }

    const mainBranch = project.main_branch || 'main';
    
    // Add message to session output about starting the rebase
    const timestamp = new Date().toLocaleTimeString();
    const startMessage = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 🔄 GIT OPERATION \x1b[0m\r\n` +
                        `\x1b[1m\x1b[94mRebasing from ${mainBranch}...\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: startMessage,
      timestamp: new Date()
    });
    
    await worktreeManager.rebaseMainIntoWorktree(session.worktreePath, mainBranch);
    
    // Add success message to session output
    const successMessage = `\x1b[32m✓ Successfully rebased ${mainBranch} into worktree\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: successMessage,
      timestamp: new Date()
    });
    
    return { success: true, data: { message: `Successfully rebased ${mainBranch} into worktree` } };
  } catch (error: any) {
    console.error('Failed to rebase main into worktree:', error);
    
    // Add error message to session output
    const errorMessage = `\x1b[31m✗ Rebase failed: ${error.message || 'Unknown error'}\x1b[0m\r\n` +
                        (error.gitOutput ? `\r\n\x1b[90mGit output:\x1b[0m\r\n${error.gitOutput}\r\n` : '') +
                        `\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stderr',
      data: errorMessage,
      timestamp: new Date()
    });
    // Pass detailed git error information to frontend
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rebase main into worktree',
      gitError: {
        command: error.gitCommand,
        output: error.gitOutput,
        workingDirectory: error.workingDirectory,
        originalError: error.originalError?.message
      }
    };
  }
});

ipcMain.handle('sessions:abort-rebase-and-use-claude', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.worktreePath) {
      return { success: false, error: 'Session has no worktree path' };
    }

    // Get the project to find the main branch
    const project = sessionManager.getProjectForSession(sessionId);
    if (!project) {
      return { success: false, error: 'Project not found for session' };
    }

    const mainBranch = project.main_branch || 'main';

    // First, abort the rebase
    try {
      await worktreeManager.abortRebase(session.worktreePath);
      
      // Add message to session output about aborting the rebase
      const timestamp = new Date().toLocaleTimeString();
      const abortMessage = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 🔄 GIT OPERATION \x1b[0m\r\n` +
                          `\x1b[1m\x1b[94mAborted rebase successfully\x1b[0m\r\n\r\n`;
      sessionManager.addSessionOutput(sessionId, {
        type: 'stdout',
        data: abortMessage,
        timestamp: new Date()
      });
    } catch (abortError: any) {
      console.error('Failed to abort rebase:', abortError);
      // Continue anyway - the user might have already resolved it
    }

    // Send the prompt to Claude Code to handle the rebase
    const prompt = `Please rebase ${mainBranch} into this branch and resolve all conflicts`;
    
    // Check if session is waiting for input or stopped
    const currentSession = await sessionManager.getSession(sessionId);
    if (!currentSession) {
      return { success: false, error: 'Session not found' };
    }
    
    if (currentSession.status === 'waiting' || currentSession.status === 'running') {
      // Session is already running, just send the input
      const userInputDisplay = `> ${prompt.trim()}\n`;
      await sessionManager.addSessionOutput(sessionId, {
        type: 'stdout',
        data: userInputDisplay,
        timestamp: new Date()
      });
      
      claudeCodeManager.sendInput(sessionId, prompt + '\n');
      return { success: true, data: { message: 'Sent rebase prompt to Claude Code' } };
    } else {
      // Session is stopped, need to continue the conversation
      try {
        // Get conversation history
        const conversationHistory = sessionManager.getConversationMessages(sessionId);
        
        // Update session status to initializing
        sessionManager.updateSession(sessionId, { 
          status: 'initializing',
          run_started_at: null
        });
        
        // Add the prompt to conversation
        if (prompt) {
          sessionManager.continueConversation(sessionId, prompt);
        }
        
        // Continue the session with proper worktree path
        await claudeCodeManager.continueSession(sessionId, session.worktreePath, prompt, conversationHistory);
        
        return { success: true, data: { message: 'Rebase aborted and Claude Code prompted to handle conflicts' } };
      } catch (error: any) {
        console.error('Failed to continue session:', error);
        return { success: false, error: 'Failed to continue Claude Code session' };
      }
    }
  } catch (error: any) {
    console.error('Failed to abort rebase and use Claude:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to abort rebase and use Claude'
    };
  }
});

ipcMain.handle('sessions:squash-and-rebase-to-main', async (_event, sessionId: string, commitMessage: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.worktreePath) {
      return { success: false, error: 'Session has no worktree path' };
    }

    // Get the project to find the main branch and project path
    const project = sessionManager.getProjectForSession(sessionId);
    if (!project) {
      return { success: false, error: 'Project not found for session' };
    }

    const mainBranch = project.main_branch || 'main';
    
    // Add message to session output about starting the squash and rebase
    const timestamp = new Date().toLocaleTimeString();
    const startMessage = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 🔄 GIT OPERATION \x1b[0m\r\n` +
                        `\x1b[1m\x1b[94mSquashing commits and rebasing to ${mainBranch}...\x1b[0m\r\n` +
                        `\x1b[90mCommit message: ${commitMessage.split('\n')[0]}${commitMessage.includes('\n') ? '...' : ''}\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: startMessage,
      timestamp: new Date()
    });
    
    await worktreeManager.squashAndRebaseWorktreeToMain(project.path, session.worktreePath, mainBranch, commitMessage);
    
    // Add success message to session output
    const successMessage = `\x1b[32m✓ Successfully squashed and rebased worktree to ${mainBranch}\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: successMessage,
      timestamp: new Date()
    });
    
    return { success: true, data: { message: `Successfully squashed and rebased worktree to ${mainBranch}` } };
  } catch (error: any) {
    console.error('Failed to squash and rebase worktree to main:', error);
    
    // Add error message to session output
    const errorMessage = `\x1b[31m✗ Squash and rebase failed: ${error.message || 'Unknown error'}\x1b[0m\r\n` +
                        (error.gitOutput ? `\r\n\x1b[90mGit output:\x1b[0m\r\n${error.gitOutput}\r\n` : '') +
                        `\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stderr',
      data: errorMessage,
      timestamp: new Date()
    });
    // Pass detailed git error information to frontend
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to squash and rebase worktree to main',
      gitError: {
        commands: error.gitCommands,
        output: error.gitOutput,
        workingDirectory: error.workingDirectory,
        projectPath: error.projectPath,
        originalError: error.originalError?.message
      }
    };
  }
});

ipcMain.handle('sessions:rebase-to-main', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.worktreePath) {
      return { success: false, error: 'Session has no worktree path' };
    }

    // Get the project to find the main branch and project path
    const project = sessionManager.getProjectForSession(sessionId);
    if (!project) {
      return { success: false, error: 'Project not found for session' };
    }

    const mainBranch = project.main_branch || 'main';
    
    // Add message to session output about starting the rebase
    const timestamp = new Date().toLocaleTimeString();
    const startMessage = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 🔄 GIT OPERATION \x1b[0m\r\n` +
                        `\x1b[1m\x1b[94mRebasing to ${mainBranch} (preserving all commits)...\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: startMessage,
      timestamp: new Date()
    });
    
    await worktreeManager.rebaseWorktreeToMain(project.path, session.worktreePath, mainBranch);
    
    // Add success message to session output
    const successMessage = `\x1b[32m✓ Successfully rebased worktree to ${mainBranch}\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: successMessage,
      timestamp: new Date()
    });
    
    return { success: true, data: { message: `Successfully rebased worktree to ${mainBranch}` } };
  } catch (error: any) {
    console.error('Failed to rebase worktree to main:', error);
    
    // Add error message to session output
    const errorMessage = `\x1b[31m✗ Rebase failed: ${error.message || 'Unknown error'}\x1b[0m\r\n` +
                        (error.gitOutput ? `\r\n\x1b[90mGit output:\x1b[0m\r\n${error.gitOutput}\r\n` : '') +
                        `\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stderr',
      data: errorMessage,
      timestamp: new Date()
    });
    // Pass detailed git error information to frontend
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rebase worktree to main',
      gitError: {
        commands: error.gitCommands,
        output: error.gitOutput,
        workingDirectory: error.workingDirectory,
        projectPath: error.projectPath,
        originalError: error.originalError?.message
      }
    };
  }
});

// Git pull/push operations for main repo sessions
ipcMain.handle('sessions:git-pull', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.worktreePath) {
      return { success: false, error: 'Session has no worktree path' };
    }

    // Add message to session output about starting the pull
    const timestamp = new Date().toLocaleTimeString();
    const startMessage = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 🔄 GIT OPERATION \x1b[0m\r\n` +
                        `\x1b[1m\x1b[94mPulling latest changes from remote...\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: startMessage,
      timestamp: new Date()
    });

    // Run git pull
    const result = await worktreeManager.gitPull(session.worktreePath);
    
    // Add success message to session output
    const successMessage = `\x1b[32m✓ Successfully pulled latest changes\x1b[0m\r\n` +
                          (result.output ? `\r\n\x1b[90mGit output:\x1b[0m\r\n${result.output}\r\n` : '') +
                          `\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: successMessage,
      timestamp: new Date()
    });
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Failed to pull from remote:', error);
    
    // Add error message to session output
    const errorMessage = `\x1b[31m✗ Pull failed: ${error.message || 'Unknown error'}\x1b[0m\r\n` +
                        (error.gitOutput ? `\r\n\x1b[90mGit output:\x1b[0m\r\n${error.gitOutput}\r\n` : '') +
                        `\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stderr',
      data: errorMessage,
      timestamp: new Date()
    });

    // Check if it's a merge conflict
    if (error.message?.includes('CONFLICT') || error.gitOutput?.includes('CONFLICT')) {
      return {
        success: false,
        error: 'Merge conflicts detected. Please resolve conflicts manually or ask Claude to help.',
        isMergeConflict: true,
        gitError: {
          output: error.gitOutput || error.message,
          workingDirectory: error.workingDirectory || ''
        }
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pull from remote',
      gitError: {
        output: error.gitOutput || error.message,
        workingDirectory: error.workingDirectory || ''
      }
    };
  }
});

ipcMain.handle('sessions:git-push', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.worktreePath) {
      return { success: false, error: 'Session has no worktree path' };
    }

    // Add message to session output about starting the push
    const timestamp = new Date().toLocaleTimeString();
    const startMessage = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m\x1b[44m\x1b[37m 🔄 GIT OPERATION \x1b[0m\r\n` +
                        `\x1b[1m\x1b[94mPushing changes to remote...\x1b[0m\r\n\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: startMessage,
      timestamp: new Date()
    });

    // Run git push
    const result = await worktreeManager.gitPush(session.worktreePath);
    
    // Add success message to session output
    const successMessage = `\x1b[32m✓ Successfully pushed changes to remote\x1b[0m\r\n` +
                          (result.output ? `\r\n\x1b[90mGit output:\x1b[0m\r\n${result.output}\r\n` : '') +
                          `\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stdout',
      data: successMessage,
      timestamp: new Date()
    });
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Failed to push to remote:', error);
    
    // Add error message to session output
    const errorMessage = `\x1b[31m✗ Push failed: ${error.message || 'Unknown error'}\x1b[0m\r\n` +
                        (error.gitOutput ? `\r\n\x1b[90mGit output:\x1b[0m\r\n${error.gitOutput}\r\n` : '') +
                        `\r\n`;
    sessionManager.addSessionOutput(sessionId, {
      type: 'stderr',
      data: errorMessage,
      timestamp: new Date()
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to push to remote',
      gitError: {
        output: error.gitOutput || error.message,
        workingDirectory: error.workingDirectory || ''
      }
    };
  }
});

ipcMain.handle('sessions:get-last-commits', async (_event, sessionId: string, count: number = 20) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (!session.worktreePath) {
      return { success: false, error: 'Session has no worktree path' };
    }

    // Get the last N commits from the repository
    const commits = await worktreeManager.getLastCommits(session.worktreePath, count);
    
    // Transform commits to match ExecutionDiff format
    const executionDiffs = commits.map((commit, index) => ({
      id: index + 1,
      session_id: sessionId,
      prompt_text: commit.message,
      execution_sequence: commits.length - index,
      stats_additions: commit.additions || 0,
      stats_deletions: commit.deletions || 0,
      stats_files_changed: commit.filesChanged || 0,
      after_commit_hash: commit.hash,
      timestamp: commit.date
    }));
    
    return { success: true, data: executionDiffs };
  } catch (error: any) {
    console.error('Failed to get last commits:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get last commits' 
    };
  }
});

// Git operation helpers
ipcMain.handle('sessions:has-changes-to-rebase', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    const project = sessionManager.getProjectForSession(sessionId);
    if (!project) {
      return { success: false, error: 'Project not found for session' };
    }

    const mainBranch = project.main_branch || 'main';
    const hasChanges = await worktreeManager.hasChangesToRebase(session.worktreePath, mainBranch);

    return { success: true, data: hasChanges };
  } catch (error) {
    console.error('Failed to check for changes to rebase:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to check for changes to rebase' };
  }
});

ipcMain.handle('sessions:get-git-commands', async (_event, sessionId: string) => {
  try {
    const session = await sessionManager.getSession(sessionId);
    if (!session || !session.worktreePath) {
      return { success: false, error: 'Session or worktree path not found' };
    }

    const project = sessionManager.getProjectForSession(sessionId);
    if (!project) {
      return { success: false, error: 'Project not found for session' };
    }

    const mainBranch = project.main_branch || 'main';

    // Get current branch name
    const { execSync } = require('child_process');
    const currentBranch = execSync(`cd "${session.worktreePath}" && git branch --show-current`, { encoding: 'utf8' }).trim();

    const rebaseCommands = worktreeManager.generateRebaseCommands(mainBranch);
    const squashCommands = worktreeManager.generateSquashCommands(mainBranch, currentBranch);

    return {
      success: true,
      data: {
        rebaseCommands,
        squashCommands,
        mainBranch,
        currentBranch
      }
    };
  } catch (error) {
    console.error('Failed to get git commands:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get git commands' };
  }
});

// Prompts handlers
ipcMain.handle('prompts:get-all', async () => {
  try {
    const prompts = sessionManager.getPromptHistory();
    return { success: true, data: prompts };
  } catch (error) {
    console.error('Failed to get prompts:', error);
    return { success: false, error: 'Failed to get prompts' };
  }
});

ipcMain.handle('prompts:get-by-id', async (_event, promptId: string) => {
  try {
    const promptMarker = sessionManager.getPromptById(promptId);
    return { success: true, data: promptMarker };
  } catch (error) {
    console.error('Failed to get prompt by id:', error);
    return { success: false, error: 'Failed to get prompt by id' };
  }
});

// System utilities
ipcMain.handle('openExternal', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to open URL' };
  }
});

// Stravu OAuth integration handlers
ipcMain.handle('stravu:get-connection-status', async () => {
  try {
    const connectionState = stravuAuthManager.getConnectionState();
    return { success: true, data: connectionState };
  } catch (error) {
    console.error('Failed to get Stravu connection status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get connection status' };
  }
});

ipcMain.handle('stravu:initiate-auth', async () => {
  try {
    const result = await stravuAuthManager.authenticate();
    return {
      success: true,
      data: {
        authUrl: stravuAuthManager.getCurrentSession()?.authUrl,
        sessionId: stravuAuthManager.getCurrentSession()?.sessionId
      }
    };
  } catch (error) {
    console.error('Failed to initiate Stravu authentication:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to initiate authentication' };
  }
});

ipcMain.handle('stravu:check-auth-status', async (_event, sessionId: string) => {
  try {
    const result = await stravuAuthManager.pollForCompletion(sessionId);

    if (result.status === 'pending') {
      return { success: true, data: { status: 'pending' } };
    } else {
      return {
        success: true,
        data: {
          status: 'completed',
          memberInfo: {
            memberId: result.memberId || '',
            orgSlug: result.orgSlug || '',
            scopes: result.scopes || []
          }
        }
      };
    }
  } catch (error) {
    console.error('Failed to check Stravu auth status:', error);
    return {
      success: true,
      data: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Authentication failed'
      }
    };
  }
});

ipcMain.handle('stravu:disconnect', async () => {
  try {
    await stravuAuthManager.disconnect();
    stravuNotebookService.clearCache();
    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect from Stravu:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to disconnect' };
  }
});

ipcMain.handle('stravu:get-notebooks', async () => {
  try {
    if (!stravuAuthManager.isConnected()) {
      return { success: false, error: 'Not connected to Stravu' };
    }

    const notebooks = await stravuNotebookService.getNotebooks();
    return { success: true, data: notebooks };
  } catch (error) {
    console.error('Failed to get Stravu notebooks:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get notebooks' };
  }
});

ipcMain.handle('stravu:get-notebook', async (_event, notebookId: string) => {
  try {
    if (!stravuAuthManager.isConnected()) {
      return { success: false, error: 'Not connected to Stravu' };
    }

    const notebook = await stravuNotebookService.getNotebookContent(notebookId);
    return { success: true, data: notebook };
  } catch (error) {
    console.error('Failed to get Stravu notebook:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get notebook' };
  }
});

ipcMain.handle('stravu:search-notebooks', async (_event, query: string, limit?: number) => {
  try {
    if (!stravuAuthManager.isConnected()) {
      return { success: false, error: 'Not connected to Stravu' };
    }

    const results = await stravuNotebookService.searchNotebooks(query, limit);
    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to search Stravu notebooks:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to search notebooks' };
  }
});

// Export getter function for mainWindow
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
