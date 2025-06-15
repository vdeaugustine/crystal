import { useState, useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useTheme } from '../contexts/ThemeContext';
import { API } from '../utils/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Session, GitCommands, GitErrorDetails } from '../types/session';

export type ViewMode = 'output' | 'messages' | 'changes' | 'terminal';

export const useSessionView = (
  activeSession: Session | undefined,
  terminalRef: React.RefObject<HTMLDivElement>,
  scriptTerminalRef: React.RefObject<HTMLDivElement>
) => {
  const { theme } = useTheme();
  const activeSessionId = activeSession?.id;

  // Terminal instances
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const scriptTerminalInstance = useRef<Terminal | null>(null);
  const scriptFitAddon = useRef<FitAddon | null>(null);

  // States
  const [viewMode, setViewMode] = useState<ViewMode>('output');
  const [unreadActivity, setUnreadActivity] = useState({
    output: false,
    messages: false,
    changes: false,
    terminal: false,
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [scriptOutput, setScriptOutput] = useState<string[]>([]);
  const [formattedOutput, setFormattedOutput] = useState<string>('');
  const [currentSessionIdForOutput, setCurrentSessionIdForOutput] = useState<string | null>(null);
  const [isPathCollapsed, setIsPathCollapsed] = useState(true);
  const [input, setInput] = useState('');
  const [ultrathink, setUltrathink] = useState(false);
  const [isLoadingOutput, setIsLoadingOutput] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gitCommands, setGitCommands] = useState<GitCommands | null>(null);
  const [hasChangesToRebase, setHasChangesToRebase] = useState<boolean>(false);
  const [showCommitMessageDialog, setShowCommitMessageDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [dialogType, setDialogType] = useState<'rebase' | 'squash'>('rebase');
  const [showGitErrorDialog, setShowGitErrorDialog] = useState(false);
  const [gitErrorDetails, setGitErrorDetails] = useState<GitErrorDetails | null>(null);
  const [showStravuSearch, setShowStravuSearch] = useState(false);
  const [isStravuConnected, setIsStravuConnected] = useState(false);
  const [shouldSquash, setShouldSquash] = useState(true);
  const [isWaitingForFirstOutput, setIsWaitingForFirstOutput] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [, forceUpdate] = useState({});
  const [shouldReloadOutput, setShouldReloadOutput] = useState(false);

  // Refs
  const previousSessionIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const lastProcessedOutputLength = useRef(0);
  const lastProcessedScriptOutputLength = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousStatusRef = useRef<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);


  const loadOutputContent = useCallback(async (sessionId: string, retryCount = 0) => {
    if (!terminalInstance.current) return;
    if (loadingRef.current) return;

    loadingRef.current = true;
    setIsLoadingOutput(true);
    setLoadError(null);

    try {
      const response = await API.sessions.getOutput(sessionId);
      if (!response.success) throw new Error(response.error || 'Failed to load output');
      
      const outputs = response.data || [];
      const currentActiveSession = useSessionStore.getState().getActiveSession();
      if (!currentActiveSession || currentActiveSession.id !== sessionId) return;

      await new Promise(resolve => setTimeout(resolve, 50));
      const stillActiveSession = useSessionStore.getState().getActiveSession();
      if (!stillActiveSession || stillActiveSession.id !== sessionId) return;
      
      if (outputs.length > 0 || retryCount === 0) {
        useSessionStore.getState().setSessionOutputs(sessionId, outputs);
        const updatedSession = useSessionStore.getState().getActiveSession();
        if (updatedSession && isWaitingForFirstOutput && (updatedSession.output?.length > 0 || updatedSession.jsonMessages?.length > 0)) {
          setIsWaitingForFirstOutput(false);
        }
      }
      setLoadError(null);
    } catch (error) {
      const isNewSession = activeSession?.status === 'initializing' || (activeSession?.status === 'running' && retryCount < 2);
      const maxRetries = isNewSession ? 10 : 3;
      if (retryCount < maxRetries) {
        const delay = (isNewSession ? 2000 : 1000) + (retryCount * 500) + Math.random() * 500;
        setTimeout(() => {
          const currentActiveSession = useSessionStore.getState().getActiveSession();
          if (currentActiveSession && currentActiveSession.id === sessionId) {
            loadOutputContent(sessionId, retryCount + 1);
          }
        }, delay);
      } else if (!isNewSession) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load output content');
      }
    } finally {
      loadingRef.current = false;
      setIsLoadingOutput(false);
    }
  }, [activeSession?.status, isWaitingForFirstOutput]);

  useEffect(() => {
    if (!activeSessionId) return;
    const unsubscribe = useSessionStore.subscribe((state) => {
      const updatedSession = state.activeMainRepoSession?.id === activeSessionId
        ? state.activeMainRepoSession
        : state.sessions.find(s => s.id === activeSessionId);
      
      if (updatedSession && updatedSession.status !== activeSession?.status) {
        if (activeSession?.status === 'initializing' && updatedSession.status === 'running') {
          terminalInstance.current?.clear();
          setShouldReloadOutput(true);
        }
        forceUpdate({});
      }
    });
    const handleStatusChange = (event: CustomEvent) => {
      if (event.detail.sessionId === activeSessionId) forceUpdate({});
    };
    window.addEventListener('session-status-changed', handleStatusChange as EventListener);
    return () => {
      unsubscribe();
      window.removeEventListener('session-status-changed', handleStatusChange as EventListener);
    };
  }, [activeSessionId, activeSession?.status]);

  useEffect(() => {
    if (!activeSession) {
      setScriptOutput([]);
      return;
    }
    const unsubscribe = useSessionStore.subscribe((state) => {
      const sessionScriptOutput = state.scriptOutput[activeSession.id] || [];
      setScriptOutput(sessionScriptOutput);
      if (viewMode !== 'terminal' && sessionScriptOutput.length > 0) {
        setUnreadActivity(prev => ({ ...prev, terminal: true }));
      }
    });
    setScriptOutput(useSessionStore.getState().scriptOutput[activeSession.id] || []);
    return unsubscribe;
  }, [activeSession?.id, viewMode]);

  useEffect(() => {
    const currentSessionId = activeSession?.id || null;
    if (currentSessionId === previousSessionIdRef.current) return;

    previousSessionIdRef.current = currentSessionId;
    if (terminalInstance.current) terminalInstance.current.clear();
    setFormattedOutput('');
    setCurrentSessionIdForOutput(null);

    if (!activeSession) return;

    setCurrentSessionIdForOutput(activeSession.id);
    if (scriptTerminalInstance.current) {
      scriptTerminalInstance.current.reset();
      scriptTerminalInstance.current.writeln('Terminal ready for script execution...\r\n');
    }
    lastProcessedOutputLength.current = 0;
    lastProcessedScriptOutputLength.current = 0;

    const hasOutput = activeSession.output && activeSession.output.length > 0;
    const hasMessages = activeSession.jsonMessages && activeSession.jsonMessages.length > 0;
    const isNewSession = activeSession.status === 'initializing' || (activeSession.status === 'running' && !hasOutput && !hasMessages);
    
    if (isNewSession) {
      setIsWaitingForFirstOutput(true);
      setStartTime(Date.now());
    } else {
      setIsWaitingForFirstOutput(false);
    }
  }, [activeSession?.id]);

  const messageCount = activeSession?.jsonMessages?.length || 0;
  const outputCount = activeSession?.output?.length || 0;

  useEffect(() => {
    if (!activeSession || currentSessionIdForOutput !== activeSession.id) return;
    if (messageCount === 0 && outputCount === 0) return;

    if (isWaitingForFirstOutput && (messageCount > 0 || outputCount > 0)) {
      setIsWaitingForFirstOutput(false);
    }

    const formatOutput = () => {
      const currentActiveSession = useSessionStore.getState().getActiveSession();
      if (!currentActiveSession || currentActiveSession.id !== activeSession.id) return;
      let formatted = currentActiveSession.output?.join('') || '';
      const finalActiveSession = useSessionStore.getState().getActiveSession();
      if (finalActiveSession && finalActiveSession.id === activeSession.id && currentSessionIdForOutput === activeSession.id) {
        setFormattedOutput(formatted);
      }
    };
    formatOutput();
  }, [activeSession?.id, messageCount, outputCount, currentSessionIdForOutput, isWaitingForFirstOutput]);
  
  useEffect(() => {
    if (shouldReloadOutput && activeSession) {
      loadOutputContent(activeSession.id);
      setShouldReloadOutput(false);
    }
  }, [shouldReloadOutput, activeSession, loadOutputContent]);

  const initTerminal = useCallback((termRef: React.RefObject<HTMLDivElement>, instanceRef: React.MutableRefObject<Terminal | null>, fitAddonRef: React.MutableRefObject<FitAddon | null>, isScript: boolean) => {
    if (!termRef.current || instanceRef.current) return;

    const term = new Terminal({
        cursorBlink: !isScript,
        convertEol: true,
        rows: 30,
        cols: 80,
        scrollback: 50000,
        theme: theme === 'light' ? lightTheme : (isScript ? scriptDarkTheme : darkTheme)
    });

    const addon = new FitAddon();
    term.loadAddon(addon);
    term.open(termRef.current);
    setTimeout(() => addon.fit(), 100);

    instanceRef.current = term;
    fitAddonRef.current = addon;

    if (isScript) {
        term.writeln('Terminal ready for script execution...\r\n');
    }
  }, [theme]);

  useEffect(() => {
    initTerminal(terminalRef, terminalInstance, fitAddon, false);
  }, [terminalRef, initTerminal]);
  
  useEffect(() => {
    if (viewMode === 'terminal') {
      initTerminal(scriptTerminalRef, scriptTerminalInstance, scriptFitAddon, true);
    }
  }, [viewMode, scriptTerminalRef, initTerminal]);
  
  useEffect(() => {
    if (!terminalRef.current || !activeSession) return;
  
    const hasOutput = activeSession.output?.length > 0;
    const hasMessages = activeSession.jsonMessages?.length > 0;
  
    if (activeSession.status === 'initializing' && !hasOutput && !hasMessages) {
      terminalInstance.current?.writeln('\r\n🚀 Starting Claude Code session...\r\n');
      setTimeout(() => {
        const currentActiveSession = useSessionStore.getState().getActiveSession();
        if (currentActiveSession?.id === activeSession.id) {
          loadOutputContent(activeSession.id);
        }
      }, 1000);
    } else if (hasOutput || hasMessages) {
      setTimeout(() => {
        const currentActiveSession = useSessionStore.getState().getActiveSession();
        if (currentActiveSession?.id === activeSession.id) {
          loadOutputContent(activeSession.id);
        }
      }, 100);
    }
  }, [activeSession?.id, activeSession?.status, loadOutputContent]);

  useEffect(() => {
    const checkStravuConnection = async () => {
      try {
        const response = await API.stravu.getConnectionStatus();
        setIsStravuConnected(response.success && response.data.status === 'connected');
      } catch (err) {
        setIsStravuConnected(false);
      }
    };
    checkStravuConnection();
    const interval = setInterval(checkStravuConnection, 30000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  useEffect(() => {
    if (!scriptTerminalInstance.current || !activeSession) return;
    scriptTerminalInstance.current.reset();
    scriptTerminalInstance.current.writeln('Terminal ready for script execution...\r\n');
    lastProcessedScriptOutputLength.current = 0;
  }, [activeSessionId]);

  useEffect(() => {
    if (!scriptTerminalInstance.current || !activeSession) return;
    const existingOutput = scriptOutput.join('');
    if (existingOutput && lastProcessedScriptOutputLength.current === 0) {
      scriptTerminalInstance.current.write(existingOutput);
      lastProcessedScriptOutputLength.current = existingOutput.length;
    }
  }, [activeSessionId, scriptOutput]);
  
  useEffect(() => {
    if (!scriptTerminalInstance.current || viewMode !== 'terminal' || !activeSession) return;
    const currentScriptOutput = useSessionStore.getState().scriptOutput[activeSession.id] || [];
    if (lastProcessedScriptOutputLength.current === 0 && currentScriptOutput.length > 0) {
      const existingOutput = currentScriptOutput.join('');
      scriptTerminalInstance.current.write(existingOutput);
      lastProcessedScriptOutputLength.current = existingOutput.length;
    }
  }, [viewMode, activeSessionId]);

  useEffect(() => {
    if (!terminalInstance.current || !formattedOutput) return;
    const currentActiveSession = useSessionStore.getState().getActiveSession();
    if (!currentActiveSession || currentSessionIdForOutput !== currentActiveSession.id) return;

    if (lastProcessedOutputLength.current === 0) {
      terminalInstance.current.write(formattedOutput);
    } else if (formattedOutput.length > lastProcessedOutputLength.current) {
      terminalInstance.current.write(formattedOutput.substring(lastProcessedOutputLength.current));
    }
    lastProcessedOutputLength.current = formattedOutput.length;
    terminalInstance.current.scrollToBottom();
  }, [formattedOutput, currentSessionIdForOutput]);

  useEffect(() => {
    if (!scriptTerminalInstance.current || !activeSession) return;
    const fullScriptOutput = scriptOutput.join('');
    if (fullScriptOutput.length < lastProcessedScriptOutputLength.current || fullScriptOutput.length === 0) {
      scriptTerminalInstance.current.reset();
      scriptTerminalInstance.current.writeln('Terminal ready for script execution...\r\n');
      lastProcessedScriptOutputLength.current = 0;
    }
    if (fullScriptOutput.length > lastProcessedScriptOutputLength.current) {
      const newOutput = fullScriptOutput.substring(lastProcessedScriptOutputLength.current);
      scriptTerminalInstance.current.write(newOutput);
      lastProcessedScriptOutputLength.current = fullScriptOutput.length;
      scriptTerminalInstance.current.scrollToBottom();
    }
  }, [scriptOutput, activeSessionId]);

  useEffect(() => {
    return () => {
      terminalInstance.current?.dispose();
      terminalInstance.current = null;
      scriptTerminalInstance.current?.dispose();
      scriptTerminalInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      fitAddon.current?.fit();
      scriptFitAddon.current?.fit();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewMode === 'output') fitAddon.current?.fit();
      else if (viewMode === 'terminal') scriptFitAddon.current?.fit();
    }, 100);
    return () => clearTimeout(timer);
  }, [viewMode]);

  useEffect(() => {
    if (!terminalRef.current) return;
    const observer = new ResizeObserver(() => {
      if (viewMode === 'output') fitAddon.current?.fit();
    });
    observer.observe(terminalRef.current);
    return () => observer.disconnect();
  }, [terminalRef, viewMode]);

  useEffect(() => {
    if (terminalInstance.current) terminalInstance.current.options.theme = theme === 'light' ? lightTheme : darkTheme;
    if (scriptTerminalInstance.current) scriptTerminalInstance.current.options.theme = theme === 'light' ? lightTheme : scriptDarkTheme;
  }, [theme]);

  useEffect(() => {
    if (!scriptTerminalRef.current) return;
    let resizeTimer: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        if (viewMode === 'terminal' && scriptFitAddon.current && scriptTerminalInstance.current) {
          scriptFitAddon.current.fit();
          const { cols, rows } = scriptTerminalInstance.current;
          if (activeSession) await API.sessions.resizeTerminal(activeSession.id, cols, rows);
        }
      }, 100);
    });
    observer.observe(scriptTerminalRef.current);
    return () => observer.disconnect();
  }, [scriptTerminalRef, viewMode, activeSession]);

  useEffect(() => {
    if (!activeSession) return;
    const currentMessageCount = activeSession.jsonMessages?.length || 0;
    if (currentMessageCount > previousMessageCountRef.current && viewMode !== 'messages') {
      setUnreadActivity(prev => ({ ...prev, messages: true }));
    }
    previousMessageCountRef.current = currentMessageCount;
  }, [activeSession?.jsonMessages?.length, viewMode]);

  useEffect(() => {
    if (!activeSession) return;
    if (['running', 'initializing'].includes(activeSession.status)) {
      const sessionStartTime = activeSession.runStartedAt ? new Date(activeSession.runStartedAt).getTime() : Date.now();
      if (!startTime || startTime !== sessionStartTime) setStartTime(sessionStartTime);
      
      setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000));
      const interval = setInterval(() => setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000)), 5000);
      return () => clearInterval(interval);
    } else {
      setStartTime(null);
      setElapsedTime(0);
    }
  }, [activeSession?.status, activeSession?.runStartedAt, activeSessionId]);

  useEffect(() => {
    setUnreadActivity({ output: false, messages: false, changes: false, terminal: false });
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSession || !terminalInstance.current) return;
    const hasEmptyOutput = !activeSession.output?.length && !activeSession.jsonMessages?.length;
    if (hasEmptyOutput && activeSession.status !== 'initializing' && currentSessionIdForOutput === activeSession.id) {
      setTimeout(() => loadOutputContent(activeSession.id), 200);
    }
  }, [activeSessionId, currentSessionIdForOutput, loadOutputContent]);

  useEffect(() => {
    if (!activeSession) {
      setGitCommands(null);
      setHasChangesToRebase(false);
      return;
    }
    const loadGitData = async () => {
      try {
        const [commandsResponse, changesResponse] = await Promise.all([
          API.sessions.getGitCommands(activeSession.id),
          API.sessions.hasChangesToRebase(activeSession.id)
        ]);
        if (commandsResponse.success) setGitCommands(commandsResponse.data);
        if (changesResponse.success) setHasChangesToRebase(changesResponse.data);
      } catch (error) { console.error('Error loading git data:', error); }
    };
    loadGitData();
  }, [activeSessionId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const { scrollHeight } = textareaRef.current;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 42), 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!activeSession) return;
    const { status } = activeSession;
    const prevStatus = previousStatusRef.current;
    if (prevStatus && ['stopped', 'waiting'].includes(prevStatus) && status === 'initializing') {
      setTimeout(() => loadOutputContent(activeSession.id), 200);
    }
    if (prevStatus === 'initializing' && status === 'running') {
      terminalInstance.current?.clear();
      setTimeout(() => loadOutputContent(activeSession.id), 100);
    }
    previousStatusRef.current = status;
  }, [activeSession?.status, activeSessionId, loadOutputContent]);
  
  const handleNavigateToPrompt = useCallback((marker: any) => {
    if (!terminalInstance.current) return;
    if (viewMode !== 'output') {
      setViewMode('output');
      setTimeout(() => navigateToPromptInTerminal(marker), 200);
    } else {
      navigateToPromptInTerminal(marker);
    }
  }, [viewMode]);

  const navigateToPromptInTerminal = (marker: any) => {
    if (!terminalInstance.current || !activeSession) return;
    const { prompt_text, output_line } = marker;
    if (!prompt_text) return;

    const buffer = terminalInstance.current.buffer.active;
    const searchTextStart = prompt_text.substring(0, 50).trim();
    let foundLine = -1;

    for (let i = 0; i < buffer.length; i++) {
      const lineText = buffer.getLine(i)?.translateToString(true) || '';
      if (lineText.includes('👤 User Input') || lineText.includes('👤 USER PROMPT')) {
        for (let j = 1; j <= 5 && i + j < buffer.length; j++) {
          const promptLineText = buffer.getLine(i + j)?.translateToString(true).trim();
          if (promptLineText?.includes(searchTextStart)) {
            foundLine = i;
            break;
          }
        }
        if (foundLine >= 0) break;
      }
    }
    
    if (foundLine < 0) {
        for (let i = 0; i < buffer.length; i++) {
            if(buffer.getLine(i)?.translateToString(true).includes(searchTextStart)) {
                foundLine = i;
                break;
            }
        }
    }

    if (foundLine >= 0) {
      terminalInstance.current.scrollToLine(Math.max(0, foundLine - 2));
    } else if (output_line !== undefined && output_line !== null) {
      terminalInstance.current.scrollToLine(output_line);
    }
  };
  
  useEffect(() => {
    const handlePromptNavigation = (event: CustomEvent) => {
      const { sessionId, promptMarker } = event.detail;
      if (activeSession?.id === sessionId && promptMarker) {
          handleNavigateToPrompt(promptMarker);
      }
    };
    window.addEventListener('navigateToPrompt', handlePromptNavigation as EventListener);
    return () => window.removeEventListener('navigateToPrompt', handlePromptNavigation as EventListener);
  }, [activeSession?.id, handleNavigateToPrompt]);

  const handleSendInput = async () => {
    if (!input.trim() || !activeSession) return;
    const finalInput = ultrathink ? `${input}\nultrathink` : input;
    const response = await API.sessions.sendInput(activeSession.id, `${finalInput}\n`);
    if (response.success) {
      setInput('');
      setUltrathink(false);
    }
  };

  const handleContinueConversation = async () => {
    if (!input.trim() || !activeSession) return;
    const finalInput = ultrathink ? `${input}\nultrathink` : input;
    const response = await API.sessions.continue(activeSession.id, finalInput);
    if (response.success) {
      setInput('');
      setUltrathink(false);
      setTimeout(() => loadOutputContent(activeSession.id), 500);
    }
  };

  const handleTerminalCommand = async () => {
    if (!input.trim() || !activeSession) return;
    const response = await API.sessions.runTerminalCommand(activeSession.id, input);
    if (response.success) setInput('');
  };

  const handleStopSession = async () => {
    if (activeSession) await API.sessions.stop(activeSession.id);
  };
  
  const handleGitPull = async () => {
    if (!activeSession) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      const response = await API.sessions.gitPull(activeSession.id);
      if (!response.success) {
        if (response.error?.includes('conflict') || response.error?.includes('merge')) {
          setGitErrorDetails({
            title: 'Pull Failed - Merge Conflicts',
            message: 'There are merge conflicts that need to be resolved manually.',
            command: 'git pull',
            output: response.details || response.error || 'No output available',
            workingDirectory: activeSession.worktreePath,
          });
          setShowGitErrorDialog(true);
          setMergeError('Merge conflicts detected. You\'ll need to resolve them manually or ask Claude to help.');
        } else {
          setMergeError(response.error || 'Failed to pull from remote');
        }
      } else if (viewMode === 'changes') {
        window.location.reload();
      }
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Failed to pull from remote');
    } finally {
      setIsMerging(false);
    }
  };

  const handleGitPush = async () => {
    if (!activeSession) return;
    setIsMerging(true);
    setMergeError(null);
    try {
        const response = await API.sessions.gitPush(activeSession.id);
        if(!response.success) setMergeError(response.error || 'Failed to push to remote');
    } catch (error) {
        setMergeError(error instanceof Error ? error.message : 'Failed to push to remote');
    } finally {
        setIsMerging(false);
    }
  };
  
  const handleRebaseMainIntoWorktree = async () => {
    if (!activeSession) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      const response = await API.sessions.rebaseMainIntoWorktree(activeSession.id);
      if (!response.success) {
        if ((response as any).gitError) {
          const gitError = (response as any).gitError;
          setGitErrorDetails({
            title: 'Rebase Failed',
            message: response.error || 'Failed to rebase main into worktree',
            command: gitError.command,
            output: gitError.output || 'No output available',
            workingDirectory: gitError.workingDirectory,
            isRebaseConflict: gitError.output?.toLowerCase().includes('conflict') || false,
          });
          setShowGitErrorDialog(true);
        } else {
          setMergeError(response.error || 'Failed to rebase main into worktree');
        }
      } else {
        const changesResponse = await API.sessions.hasChangesToRebase(activeSession.id);
        if (changesResponse.success) setHasChangesToRebase(changesResponse.data);
      }
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Failed to rebase main into worktree');
    } finally {
      setIsMerging(false);
    }
  };

  const handleAbortRebaseAndUseClaude = async () => {
    if (!activeSession) return;
    setShowGitErrorDialog(false);
    setIsLoadingOutput(true);
    try {
      const response = await API.sessions.abortRebaseAndUseClaude(activeSession.id);
      if (response.success) {
        setMergeError(null);
        setGitErrorDetails(null);
      } else {
        setMergeError(response.error || 'Failed to abort rebase and use Claude Code');
      }
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Failed to abort rebase and use Claude Code');
    } finally {
      setIsLoadingOutput(false);
    }
  };
  
  const generateDefaultCommitMessage = async () => {
    if (!activeSession) return '';
    try {
      const promptsResponse = await API.sessions.getPrompts(activeSession.id);
      if (promptsResponse.success && promptsResponse.data?.length > 0) {
        return promptsResponse.data.map((p: any) => p.prompt_text || p.content).filter(Boolean).join('\n\n');
      }
    } catch (error) {
      console.error('Error generating default commit message:', error);
    }
    const mainBranch = gitCommands?.mainBranch || 'main';
    return dialogType === 'squash'
      ? `Squashed commits from ${gitCommands?.currentBranch || 'feature branch'}`
      : `Rebase from ${mainBranch}`;
  };

  const handleSquashAndRebaseToMain = async () => {
    const defaultMessage = await generateDefaultCommitMessage();
    setCommitMessage(defaultMessage);
    setDialogType('squash');
    setShouldSquash(true);
    setShowCommitMessageDialog(true);
  };
  
  const performSquashWithCommitMessage = async (message: string) => {
    if (!activeSession) return;
    setIsMerging(true);
    setMergeError(null);
    setShowCommitMessageDialog(false);
    try {
      const response = shouldSquash
        ? await API.sessions.squashAndRebaseToMain(activeSession.id, message)
        : await API.sessions.rebaseToMain(activeSession.id);

      if (!response.success) {
        if ((response as any).gitError) {
          const gitError = (response as any).gitError;
          setGitErrorDetails({
            title: shouldSquash ? 'Squash and Rebase Failed' : 'Rebase Failed',
            message: response.error || `Failed to ${shouldSquash ? 'squash and ' : ''}rebase to main`,
            commands: gitError.commands,
            output: gitError.output || 'No output available',
            workingDirectory: gitError.workingDirectory,
            projectPath: gitError.projectPath,
          });
          setShowGitErrorDialog(true);
        } else {
          setMergeError(response.error || `Failed to ${shouldSquash ? 'squash and ' : ''}rebase to main`);
        }
      } else {
        const changesResponse = await API.sessions.hasChangesToRebase(activeSession.id);
        if (changesResponse.success) setHasChangesToRebase(changesResponse.data);
      }
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : `Failed to ${shouldSquash ? 'squash and ' : ''}rebase to main`);
    } finally {
      setIsMerging(false);
    }
  };

  const handleOpenIDE = async () => {
    if(activeSession) await API.sessions.openIDE(activeSession.id);
  };
  
  const handleStravuFileSelect = (file: any, content: string) => {
    const formattedContent = `\n\n## File: ${file.name}\n\`\`\`${file.type}\n${content}\n\`\`\`\n\n`;
    setInput(prev => prev + formattedContent);
  };

  const formatElapsedTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartEditName = () => {
    if (!activeSession) return;
    setEditName(activeSession.name);
    setIsEditingName(true);
  };

  const handleSaveEditName = async () => {
    if (!activeSession || editName.trim() === '' || editName === activeSession.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await API.sessions.rename(activeSession.id, editName.trim());
      setIsEditingName(false);
    } catch (error) {
      alert('Failed to rename session');
      setEditName(activeSession.name);
      setIsEditingName(false);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditName('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEditName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  };

  const formatGitOutput = (output: string): string => {
    if (!output) return '';
    return output
      .replace(/error:/gi, '\x1b[31mERROR:\x1b[0m')
      .replace(/fatal:/gi, '\x1b[31mFATAL:\x1b[0m')
      .replace(/warning:/gi, '\x1b[33mWARNING:\x1b[0m')
      .replace(/hint:/gi, '\x1b[36mHINT:\x1b[0m')
      .replace(/CONFLICT \(.*?\):/g, '\x1b[31mCONFLICT\x1b[0m ($1):')
      .replace(/Auto-merging (.*)/g, '\x1b[33mAuto-merging\x1b[0m $1')
      .replace(/Merge conflict in (.*)/g, '\x1b[31mMerge conflict in\x1b[0m $1');
  };

  const getGitErrorTips = (details: GitErrorDetails): string[] => {
    const tips: string[] = [];
    const output = details.output?.toLowerCase() || '';
    const message = details.message?.toLowerCase() || '';
    
    if (output.includes('conflict') || message.includes('conflict')) {
      tips.push('• You have merge conflicts that need to be resolved manually');
      tips.push('• Use "git status" to see conflicted files');
      tips.push('• Edit the conflicted files to resolve conflicts, then stage and commit');
      tips.push('• After resolving, run "git rebase --continue" or "git rebase --abort"');
    } else if (output.includes('uncommitted changes') || output.includes('unstaged changes')) {
      tips.push('• You have uncommitted changes that prevent the operation');
      tips.push('• Either commit your changes first or stash them with "git stash"');
      tips.push('• After the operation, you can apply stashed changes with "git stash pop"');
    } else {
      tips.push('• Check if you have uncommitted changes that need to be resolved');
      tips.push('• Verify that the main branch exists and is up to date');
    }
    return tips;
  };
  
  return {
    theme,
    viewMode,
    setViewMode,
    unreadActivity,
    setUnreadActivity,
    isEditingName,
    editName,
    setEditName,
    isPathCollapsed,
    setIsPathCollapsed,
    input,
    setInput,
    ultrathink,
    setUltrathink,
    isLoadingOutput,
    isMerging,
    mergeError,
    loadError,
    gitCommands,
    hasChangesToRebase,
    showCommitMessageDialog,
    setShowCommitMessageDialog,
    commitMessage,
    setCommitMessage,
    dialogType,
    showGitErrorDialog,
    setShowGitErrorDialog,
    gitErrorDetails,
    showStravuSearch,
    setShowStravuSearch,
    isStravuConnected,
    shouldSquash,
    setShouldSquash,
    isWaitingForFirstOutput,
    elapsedTime,
    textareaRef,
    handleSendInput,
    handleContinueConversation,
    handleTerminalCommand,
    handleStopSession,
    handleGitPull,
    handleGitPush,
    handleRebaseMainIntoWorktree,
    handleAbortRebaseAndUseClaude,
    handleSquashAndRebaseToMain,
    performSquashWithCommitMessage,
    handleOpenIDE,
    handleStravuFileSelect,
    formatElapsedTime,
    handleStartEditName,
    handleSaveEditName,
    handleCancelEditName,
    handleNameKeyDown,
    loadOutputContent,
    formatGitOutput,
    getGitErrorTips,
    handleNavigateToPrompt,
  };
};

const lightTheme = {
  background: '#f9fafb',
  foreground: '#1f2937',
  cursor: '#1f2937',
  black: '#1f2937',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#f3f4f6',
  brightBlack: '#6b7280',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#ffffff'
};

const darkTheme = {
  background: '#000000',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
};

const scriptDarkTheme = {
  background: '#0f172a',
  foreground: '#e2e8f0',
  cursor: '#e2e8f0',
  black: '#1e293b',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#f1f5f9',
  brightBlack: '#475569',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff'
};

</rewritten_file>