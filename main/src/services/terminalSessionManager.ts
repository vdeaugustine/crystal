import { EventEmitter } from 'events';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { getShellPath } from '../utils/shellPath';

interface TerminalSession {
  pty: pty.IPty;
  sessionId: string;
  cwd: string;
}

export class TerminalSessionManager extends EventEmitter {
  private terminalSessions: Map<string, TerminalSession> = new Map();
  
  constructor() {
    super();
  }

  async createTerminalSession(sessionId: string, worktreePath: string): Promise<void> {
    // Clean up any existing session
    this.closeTerminalSession(sessionId);

    // For Linux, use the current PATH to avoid slow shell detection
    const isLinux = process.platform === 'linux';
    const shellPath = isLinux ? (process.env.PATH || '') : getShellPath();
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    
    // Create a new PTY instance with proper terminal settings
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',  // Better terminal emulation
      cwd: worktreePath,
      cols: 80,
      rows: 24,
      env: {
        ...process.env,
        PATH: shellPath,
        WORKTREE_PATH: worktreePath,
        TERM: 'xterm-256color',  // Ensure TERM is set for color support
        COLORTERM: 'truecolor',  // Enable 24-bit color
        LANG: process.env.LANG || 'en_US.UTF-8',  // Set locale for proper character handling
      },
    });

    // Store the session
    this.terminalSessions.set(sessionId, {
      pty: ptyProcess,
      sessionId,
      cwd: worktreePath,
    });

    // Handle data from the PTY
    ptyProcess.onData((data: string) => {
      this.emit('terminal-output', { sessionId, data, type: 'stdout' });
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      console.log(`Terminal session ${sessionId} exited with code ${exitCode}, signal ${signal}`);
      this.terminalSessions.delete(sessionId);
    });
  }

  sendCommand(sessionId: string, command: string): void {
    const session = this.terminalSessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }

    // Send the command to the PTY
    session.pty.write(command + '\r');
  }

  sendInput(sessionId: string, data: string): void {
    const session = this.terminalSessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }

    // Send raw input directly to the PTY without modification
    session.pty.write(data);
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    const session = this.terminalSessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  closeTerminalSession(sessionId: string): void {
    const session = this.terminalSessions.get(sessionId);
    if (session) {
      try {
        session.pty.kill();
      } catch (error) {
        console.warn(`Error killing terminal session ${sessionId}:`, error);
      }
      this.terminalSessions.delete(sessionId);
    }
  }

  hasSession(sessionId: string): boolean {
    return this.terminalSessions.has(sessionId);
  }

  cleanup(): void {
    // Close all terminal sessions
    for (const sessionId of this.terminalSessions.keys()) {
      this.closeTerminalSession(sessionId);
    }
  }
}