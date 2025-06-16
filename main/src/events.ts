import type { BrowserWindow } from 'electron';
import { execSync } from './utils/commandExecutor';
import type { AppServices } from './ipc/types';
import type { VersionInfo } from './services/versionChecker';

export function setupEventListeners(services: AppServices, getMainWindow: () => BrowserWindow | null): void {
  const {
    sessionManager,
    claudeCodeManager,
    executionTracker,
    runCommandManager,
    gitDiffManager
  } = services;

  // Listen to sessionManager events and broadcast to renderer
  sessionManager.on('session-created', (session) => {
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send('session:created', session);
    }
  });

  sessionManager.on('session-updated', (session) => {
    console.log(`[Main] session-updated event received for ${session.id} with status ${session.status}`);
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      console.log(`[Main] Sending session:updated to renderer for ${session.id}`);
      mw.webContents.send('session:updated', session);
    } else {
      console.error(`[Main] Cannot send session:updated - mainWindow is ${mw ? 'destroyed' : 'null'}`);
    }
  });

  sessionManager.on('session-deleted', (session) => {
    const mw = getMainWindow();
    if (mw) {
      mw.webContents.send('session:deleted', session);
    }
  });

  sessionManager.on('sessions-loaded', (sessions) => {
    const mw = getMainWindow();
    if (mw) {
      mw.webContents.send('sessions:loaded', sessions);
    }
  });

  sessionManager.on('session-output', (output) => {
    const mw = getMainWindow();
    if (mw) {
      mw.webContents.send('session:output', output);
    }
  });

  sessionManager.on('session-output-available', (info) => {
    const mw = getMainWindow();
    if (mw) {
      mw.webContents.send('session:output-available', info);
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

    // Check if Claude is waiting for user input
    if (output.type === 'json' && output.data.type === 'prompt') {
      console.log(`[Main] Claude is waiting for user input in session ${output.sessionId}`);
      await sessionManager.updateSession(output.sessionId, { status: 'waiting' });
    }

    // Check if Claude has completed (when it sends a completion message)
    if (output.type === 'json' && output.data.type === 'completion') {
      console.log(`[Main] Claude completed task in session ${output.sessionId}`);
      await sessionManager.updateSession(output.sessionId, { status: 'stopped' });
    }

    // Send real-time updates to renderer
    const mw = getMainWindow();
    if (mw) {
      if (output.type === 'json') {
        // For JSON, send both formatted output and raw JSON
        const { formatJsonForOutputEnhanced } = await import('./utils/toolFormatter');
        const formattedOutput = formatJsonForOutputEnhanced(output.data);
        if (formattedOutput) {
          // Send formatted as stdout for Output view
          mw.webContents.send('session:output', {
            sessionId: output.sessionId,
            type: 'stdout',
            data: formattedOutput,
            timestamp: output.timestamp
          });
        }
        // Also send raw JSON for Messages view
        mw.webContents.send('session:output', output);
      } else {
        // Send non-JSON outputs as-is
        mw.webContents.send('session:output', output);
      }
    }
  });

  claudeCodeManager.on('spawned', async ({ sessionId }: { sessionId: string }) => {
    console.log(`[Main] Claude Code spawned for session ${sessionId}, updating status to 'running'`);

    // Add a small delay to ensure the session is fully initialized
    await new Promise(resolve => setTimeout(resolve, 100));

    await sessionManager.updateSession(sessionId, {
      status: 'running',
      run_started_at: 'CURRENT_TIMESTAMP'
    });

    // Verify the update was successful
    const updatedSession = await sessionManager.getSession(sessionId);
    console.log(`[Main] Session ${sessionId} status after update: ${updatedSession?.status}`);

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
    console.log(`[Main] Claude Code exited for session ${sessionId} with code ${exitCode}, signal ${signal}`);
    await sessionManager.setSessionExitCode(sessionId, exitCode);
    console.log(`[Main] Updating session ${sessionId} status to 'stopped'`);
    await sessionManager.updateSession(sessionId, { status: 'stopped' });
    console.log(`[Main] Session ${sessionId} status update complete`);

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
    const mw = getMainWindow();
    if (mw) {
      mw.webContents.send('script:output', output);
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
    const mw = getMainWindow();
    if (mw && !mw.isDestroyed()) {
      // Only send to renderer for custom dialog - no native dialogs
      mw.webContents.send('version:update-available', versionInfo);
    }
  });
} 