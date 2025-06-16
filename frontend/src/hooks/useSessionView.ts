import { useState, useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useTheme } from '../contexts/ThemeContext';
import { API } from '../utils/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Session, GitCommands, GitErrorDetails } from '../types/session';
import { createVisibilityAwareInterval } from '../utils/performanceUtils';

export type ViewMode = 'output' | 'messages' | 'changes' | 'terminal';

export const useSessionView = (
  activeSession: Session | undefined,
  terminalRef: React.RefObject<HTMLDivElement | null>,
  scriptTerminalRef: React.RefObject<HTMLDivElement | null>
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
  const isContinuingConversationRef = useRef(false);


  const loadOutputContent = useCallback(async (sessionId: string, retryCount = 0) => {
    console.log(`[loadOutputContent] Called for session ${sessionId}, retry: ${retryCount}, terminal exists: ${!!terminalInstance.current}`);
    // Don't check for terminal instance here - it might not be ready yet but we still want to load the data
    if (loadingRef.current) {
      console.log(`[loadOutputContent] Already loading, skipping`);
      return;
    }

    loadingRef.current = true;
    setIsLoadingOutput(true);
    setLoadError(null);

    try {
      const response = await API.sessions.getOutput(sessionId);
      if (!response.success) throw new Error(response.error || 'Failed to load output');
      
      const outputs = response.data || [];
      console.log(`[loadOutputContent] Received ${outputs.length} outputs for session ${sessionId}`);
      
      const currentActiveSession = useSessionStore.getState().getActiveSession();
      if (!currentActiveSession || currentActiveSession.id !== sessionId) {
        console.log(`[loadOutputContent] Session ${sessionId} no longer active, aborting`);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
      const stillActiveSession = useSessionStore.getState().getActiveSession();
      if (!stillActiveSession || stillActiveSession.id !== sessionId) {
        console.log(`[loadOutputContent] Session ${sessionId} changed during delay, aborting`);
        return;
      }
      
      if (outputs.length > 0 || retryCount === 0) {
        console.log(`[loadOutputContent] Setting outputs for session ${sessionId}, count: ${outputs.length}`);
        
        // Log some sample output to verify content
        if (outputs.length > 0) {
          console.log(`[loadOutputContent] First output type: ${outputs[0].type}, data length: ${outputs[0].data?.length}`);
          console.log(`[loadOutputContent] First 200 chars of first output: ${outputs[0].data?.substring(0, 200)}`);
        }
        
        useSessionStore.getState().setSessionOutputs(sessionId, outputs);
        
        // Verify the output was set
        const updatedSession = useSessionStore.getState().getActiveSession();
        console.log(`[loadOutputContent] After setSessionOutputs - session output length: ${updatedSession?.output?.length}, jsonMessages length: ${updatedSession?.jsonMessages?.length}`);
        
        if (updatedSession && isWaitingForFirstOutput && (updatedSession.output?.length > 0 || updatedSession.jsonMessages?.length > 0)) {
          setIsWaitingForFirstOutput(false);
        }
      }
      setLoadError(null);
    } catch (error) {
      console.error(`[loadOutputContent] Error loading output for session ${sessionId}:`, error);
      const isNewSession = activeSession?.status === 'initializing' || (activeSession?.status === 'running' && retryCount < 2);
      const maxRetries = isNewSession ? 10 : 3;
      if (retryCount < maxRetries) {
        const delay = (isNewSession ? 2000 : 1000) + (retryCount * 500) + Math.random() * 500;
        console.log(`[loadOutputContent] Retrying in ${delay}ms for session ${sessionId}`);
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
          // Only clear terminal and reload for new sessions, not when continuing conversations
          const hasExistingOutput = activeSession.output && activeSession.output.length > 0;
          if (!hasExistingOutput && !isContinuingConversationRef.current) {
            terminalInstance.current?.clear();
            setShouldReloadOutput(true);
          }
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

    console.log(`[useSessionView] Session changed from ${previousSessionIdRef.current} to ${currentSessionId}`);
    previousSessionIdRef.current = currentSessionId;
    
    // Clear terminal immediately when session changes
    if (terminalInstance.current) {
      terminalInstance.current.clear();
    }
    setFormattedOutput('');
    setCurrentSessionIdForOutput(null);

    if (!activeSession) {
      console.log(`[useSessionView] No active session, returning`);
      return;
    }

    console.log(`[useSessionView] Setting up for session ${activeSession.id}, status: ${activeSession.status}`);
    setCurrentSessionIdForOutput(activeSession.id);
    
    if (scriptTerminalInstance.current) {
      scriptTerminalInstance.current.reset();
      scriptTerminalInstance.current.writeln('Terminal ready for script execution...\r\n');
    }
    
    // Reset output tracking
    lastProcessedOutputLength.current = 0;
    lastProcessedScriptOutputLength.current = 0;

    const hasOutput = activeSession.output && activeSession.output.length > 0;
    const hasMessages = activeSession.jsonMessages && activeSession.jsonMessages.length > 0;
    const isNewSession = activeSession.status === 'initializing' || (activeSession.status === 'running' && !hasOutput && !hasMessages);
    
    console.log(`[useSessionView] Session ${activeSession.id} - hasOutput: ${hasOutput}, hasMessages: ${hasMessages}, isNewSession: ${isNewSession}`);
    
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
    if (!activeSession) return;
    
    // Make sure we're tracking the right session for output
    if (currentSessionIdForOutput !== activeSession.id) {
      console.log(`[useSessionView] Session ID mismatch in format effect - current: ${currentSessionIdForOutput}, active: ${activeSession.id}`);
      // If the session ID doesn't match, update it
      if (activeSession.id) {
        setCurrentSessionIdForOutput(activeSession.id);
      }
      return;
    }
    
    if (messageCount === 0 && outputCount === 0) {
      console.log(`[useSessionView] No messages or output to format for session ${activeSession.id}`);
      return;
    }

    if (isWaitingForFirstOutput && (messageCount > 0 || outputCount > 0)) {
      setIsWaitingForFirstOutput(false);
    }

    const formatOutput = () => {
      const currentActiveSession = useSessionStore.getState().getActiveSession();
      if (!currentActiveSession || currentActiveSession.id !== activeSession.id) {
        console.log(`[formatOutput] Session changed during formatting, aborting`);
        return;
      }
      
      // The output array should already contain formatted strings from the IPC handler
      const outputArray = currentActiveSession.output || [];
      console.log(`[formatOutput] Session ${activeSession.id} has ${outputArray.length} output items`);
      
      const formatted = outputArray.join('');
      
      // Double-check we're still on the same session before updating
      const finalActiveSession = useSessionStore.getState().getActiveSession();
      if (finalActiveSession && finalActiveSession.id === activeSession.id && currentSessionIdForOutput === activeSession.id) {
        console.log(`[formatOutput] Setting formatted output for session ${activeSession.id}, length: ${formatted.length}, first 100 chars: ${formatted.substring(0, 100)}`);
        setFormattedOutput(formatted);
      } else {
        console.log(`[formatOutput] Session mismatch during final check, not setting formatted output`);
      }
    };
    
    // Use requestAnimationFrame to ensure state is settled
    requestAnimationFrame(() => {
      formatOutput();
    });
  }, [activeSession?.id, messageCount, outputCount, currentSessionIdForOutput, isWaitingForFirstOutput]);
  
  useEffect(() => {
    if (shouldReloadOutput && activeSession) {
      loadOutputContent(activeSession.id);
      setShouldReloadOutput(false);
    }
  }, [shouldReloadOutput, activeSession, loadOutputContent]);

  const initTerminal = useCallback((termRef: React.RefObject<HTMLDivElement | null>, instanceRef: React.MutableRefObject<Terminal | null>, fitAddonRef: React.MutableRefObject<FitAddon | null>, isScript: boolean) => {
    if (!termRef.current || instanceRef.current) return;

    const term = new Terminal({
        cursorBlink: !isScript,
        convertEol: true,
        rows: 30,
        cols: 80,
        scrollback: isScript ? 5000 : 10000, // Reduced from 50000 for better performance
        fastScrollModifier: 'ctrl',
        fastScrollSensitivity: 5,
        scrollSensitivity: 1,
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
    console.log(`[useSessionView] Initializing main terminal`);
    initTerminal(terminalRef, terminalInstance, fitAddon, false);
    
    // After terminal is initialized, trigger a check for loading output
    if (activeSession && !terminalInstance.current) {
      // Check less frequently and with a maximum number of attempts
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds maximum wait
      const checkInterval = setInterval(() => {
        attempts++;
        if (terminalInstance.current) {
          console.log(`[useSessionView] Terminal initialized, checking if output needs to be loaded`);
          clearInterval(checkInterval);
          // Force a re-evaluation of whether to load output
          if (activeSession.status !== 'initializing') {
            loadOutputContent(activeSession.id);
          }
        } else if (attempts >= maxAttempts) {
          console.log(`[useSessionView] Terminal initialization timed out, loading output anyway`);
          clearInterval(checkInterval);
          // Try to load output even without terminal
          if (activeSession.status !== 'initializing') {
            loadOutputContent(activeSession.id);
          }
        }
      }, 100);
    }
  }, [terminalRef, initTerminal, activeSession, loadOutputContent]);
  
  useEffect(() => {
    if (viewMode === 'terminal') {
      initTerminal(scriptTerminalRef, scriptTerminalInstance, scriptFitAddon, true);
    }
  }, [viewMode, scriptTerminalRef, initTerminal]);
  
  // Effect to load output once terminal is ready
  useEffect(() => {
    if (!terminalRef.current || !activeSession) {
      console.log(`[useSessionView] Not ready to load output - terminalRef: ${!!terminalRef.current}, activeSession: ${!!activeSession}`);
      return;
    }
    
    // Skip loading if we're continuing a conversation
    if (isContinuingConversationRef.current) {
      console.log(`[useSessionView] Skipping output load - continuing conversation`);
      return;
    }
  
    const hasOutput = activeSession.output?.length > 0;
    const hasMessages = activeSession.jsonMessages?.length > 0;
    
    console.log(`[useSessionView] Session ${activeSession.id} load check - hasOutput: ${hasOutput} (${activeSession.output?.length}), hasMessages: ${hasMessages} (${activeSession.jsonMessages?.length}), status: ${activeSession.status}`);
  
    // Wait a bit for terminal to initialize if needed
    const loadDelay = terminalInstance.current ? 200 : 500;
  
    if (activeSession.status === 'initializing' && !hasOutput && !hasMessages) {
      if (terminalInstance.current) {
        terminalInstance.current.writeln('\r\n🚀 Starting Claude Code session...\r\n');
      }
      setTimeout(() => {
        const currentActiveSession = useSessionStore.getState().getActiveSession();
        if (currentActiveSession?.id === activeSession.id && !isContinuingConversationRef.current) {
          console.log(`[useSessionView] Loading output for initializing session ${activeSession.id}`);
          loadOutputContent(activeSession.id);
        }
      }, 1000);
    } else {
      // Always load output for non-initializing sessions
      console.log(`[useSessionView] Session ${activeSession.id} needs output load - scheduling load with delay ${loadDelay}ms`);
      setTimeout(() => {
        const currentActiveSession = useSessionStore.getState().getActiveSession();
        if (currentActiveSession?.id === activeSession.id && !isContinuingConversationRef.current) {
          console.log(`[useSessionView] Loading output for session ${activeSession.id} (hasOutput: ${hasOutput}, hasMessages: ${hasMessages})`);
          loadOutputContent(activeSession.id);
        }
      }, loadDelay);
    }
  }, [activeSession?.id, activeSession?.status, loadOutputContent]); // Removed terminalInstance.current from deps to avoid loops

  // Force reload output when session becomes active with empty arrays
  // This handles the case where WebSocket events arrive before session is loaded
  useEffect(() => {
    if (!activeSession || !terminalInstance.current) return;
    
    const hasEmptyOutput = (!activeSession.output || activeSession.output.length === 0) && 
                          (!activeSession.jsonMessages || activeSession.jsonMessages.length === 0);
    const isNotNew = activeSession.status !== 'initializing';
    
    if (hasEmptyOutput && isNotNew && currentSessionIdForOutput === activeSession.id) {
      console.log(`[useSessionView] Active session ${activeSession.id} has empty output but status is ${activeSession.status}, forcing reload`);
      setTimeout(() => {
        if (terminalInstance.current) {
          loadOutputContent(activeSession.id);
        }
      }, 300);
    }
  }, [activeSession?.id, activeSession?.status, currentSessionIdForOutput, loadOutputContent]);

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
    // Use visibility-aware interval for Stravu connection checking
    const cleanup = createVisibilityAwareInterval(
      checkStravuConnection,
      30000, // 30 seconds when visible
      120000 // 2 minutes when not visible
    );
    return cleanup;
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
    console.log(`[Terminal Write Effect] Called, formatted output length: ${formattedOutput.length}, session: ${currentSessionIdForOutput}, lastProcessed: ${lastProcessedOutputLength.current}`);
    
    if (!terminalInstance.current) {
      console.log(`[Terminal Write Effect] No terminal instance`);
      return;
    }
    
    if (!formattedOutput && formattedOutput !== '') {
      console.log(`[Terminal Write Effect] No formatted output`);
      return;
    }
    
    const currentActiveSession = useSessionStore.getState().getActiveSession();
    if (!currentActiveSession || currentSessionIdForOutput !== currentActiveSession.id) {
      console.log(`[Terminal Write Effect] Session mismatch: ${currentSessionIdForOutput} !== ${currentActiveSession?.id}`);
      return;
    }

    // Write to terminal
    if (lastProcessedOutputLength.current === 0) {
      // Clear terminal and write all content for new session
      console.log(`[Terminal Write Effect] New session output detected, clearing terminal and writing all content, length: ${formattedOutput.length}`);
      terminalInstance.current.clear();
      terminalInstance.current.write(formattedOutput);
      lastProcessedOutputLength.current = formattedOutput.length;
    } else if (formattedOutput.length > lastProcessedOutputLength.current) {
      // Write only new content for existing session
      const newContent = formattedOutput.substring(lastProcessedOutputLength.current);
      console.log(`[Terminal Write Effect] Writing new content to terminal, length: ${newContent.length}`);
      terminalInstance.current.write(newContent);
      lastProcessedOutputLength.current = formattedOutput.length;
    } else if (formattedOutput.length < lastProcessedOutputLength.current) {
      // This shouldn't happen, but log it if it does
      console.warn(`[Terminal Write Effect] Formatted output shrank from ${lastProcessedOutputLength.current} to ${formattedOutput.length}`);
    }
    
    if (formattedOutput.length > 0) {
      terminalInstance.current.scrollToBottom();
    }
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
      // Use visibility-aware interval that slows down when tab is not visible
      const cleanup = createVisibilityAwareInterval(
        () => setElapsedTime(Math.floor((Date.now() - sessionStartTime) / 1000)),
        5000, // 5 seconds when visible
        30000 // 30 seconds when not visible
      );
      return cleanup;
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
    if (hasEmptyOutput && activeSession.status !== 'initializing' && currentSessionIdForOutput === activeSession.id && !isContinuingConversationRef.current) {
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
      // Don't reload output when continuing a conversation - existing output should remain
      // Only reload for truly new sessions that have no output yet
      const hasExistingOutput = activeSession.output && activeSession.output.length > 0;
      if (!hasExistingOutput && !isContinuingConversationRef.current) {
        setTimeout(() => loadOutputContent(activeSession.id), 200);
      }
    }
    if (prevStatus === 'initializing' && status === 'running') {
      // Only clear terminal for new sessions, not when continuing conversations
      const hasExistingOutput = activeSession.output && activeSession.output.length > 0;
      if (!hasExistingOutput && !isContinuingConversationRef.current) {
        terminalInstance.current?.clear();
        setTimeout(() => loadOutputContent(activeSession.id), 100);
      }
      // Reset the flag after status changes to running
      if (isContinuingConversationRef.current) {
        isContinuingConversationRef.current = false;
      }
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

  const handleSendInput = async (attachedImages?: any[]) => {
    if (!input.trim() || !activeSession) return;
    
    let finalInput = ultrathink ? `${input}\nultrathink` : input;
    
    // If there are attached images, save them and append paths to input
    if (attachedImages && attachedImages.length > 0) {
      try {
        // Save images via IPC
        const imagePaths = await window.electronAPI.sessions.saveImages(
          activeSession.id,
          attachedImages.map(img => ({
            name: img.name,
            dataUrl: img.dataUrl,
            type: img.type,
          }))
        );
        
        // Append image paths to the prompt
        const imagePathsText = imagePaths.map(path => `Image: ${path}`).join('\n');
        finalInput = `${finalInput}\n\n${imagePathsText}`;
      } catch (error) {
        console.error('Failed to save images:', error);
        // Continue without images on error
      }
    }
    
    const response = await API.sessions.sendInput(activeSession.id, `${finalInput}\n`);
    if (response.success) {
      setInput('');
      setUltrathink(false);
    }
  };

  const handleContinueConversation = async (attachedImages?: any[]) => {
    if (!input.trim() || !activeSession) return;
    
    // Mark that we're continuing a conversation to prevent output reload
    isContinuingConversationRef.current = true;
    
    let finalInput = ultrathink ? `${input}\nultrathink` : input;
    
    // If there are attached images, save them and append paths to input
    if (attachedImages && attachedImages.length > 0) {
      try {
        // Save images via IPC
        const imagePaths = await window.electronAPI.sessions.saveImages(
          activeSession.id,
          attachedImages.map(img => ({
            name: img.name,
            dataUrl: img.dataUrl,
            type: img.type,
          }))
        );
        
        // Append image paths to the prompt
        const imagePathsText = imagePaths.map(path => `Image: ${path}`).join('\n');
        finalInput = `${finalInput}\n\n${imagePathsText}`;
      } catch (error) {
        console.error('Failed to save images:', error);
        // Continue without images on error
      }
    }
    
    const response = await API.sessions.continue(activeSession.id, finalInput);
    if (response.success) {
      setInput('');
      setUltrathink(false);
      // Output will be loaded automatically when session status changes to 'initializing'
      // No need to manually reload here as it can cause timing issues
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