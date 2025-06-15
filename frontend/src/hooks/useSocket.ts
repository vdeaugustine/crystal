import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { API } from '../utils/api';
import type { Session, SessionOutput } from '../types/session';

export function useSocket() {
  const { setSessions, loadSessions, addSession, updateSession, deleteSession, addSessionOutput } = useSessionStore();
  
  useEffect(() => {
    // Check if we're in Electron environment
    if (!window.electronAPI) {
      console.warn('Electron API not available, events will not work');
      return;
    }

    // Set up IPC event listeners
    const unsubscribeFunctions: (() => void)[] = [];

    // Listen for session events
    const unsubscribeSessionCreated = window.electronAPI.events.onSessionCreated((session: Session) => {
      console.log('[useSocket] Session created:', session.id);
      addSession({...session, output: session.output || [], jsonMessages: session.jsonMessages || []});
    });
    unsubscribeFunctions.push(unsubscribeSessionCreated);

    const unsubscribeSessionUpdated = window.electronAPI.events.onSessionUpdated((session: Session) => {
      
      // Ensure we have valid session data
      if (!session || !session.id) {
        console.error('[useSocket] Invalid session data received:', session);
        return;
      }
      
      // Update the session with initialized arrays
      const sessionWithArrays = {
        ...session,
        output: session.output || [],
        jsonMessages: session.jsonMessages || []
      };
      
      updateSession(sessionWithArrays);
      
      // Force a re-render if this is the active session and status changed to stopped
      const state = useSessionStore.getState();
      if (state.activeSessionId === session.id && 
          (session.status === 'stopped' || session.status === 'completed_unviewed' || session.status === 'error')) {
        // Emit a custom event to trigger UI updates
        window.dispatchEvent(new CustomEvent('session-status-changed', { 
          detail: { sessionId: session.id, status: session.status } 
        }));
      }
    });
    unsubscribeFunctions.push(unsubscribeSessionUpdated);

    const unsubscribeSessionDeleted = window.electronAPI.events.onSessionDeleted((session: Session) => {
      console.log('[useSocket] Session deleted:', session.id);
      deleteSession(session);
    });
    unsubscribeFunctions.push(unsubscribeSessionDeleted);

    const unsubscribeSessionsLoaded = window.electronAPI.events.onSessionsLoaded((sessions: Session[]) => {
      console.log('[useSocket] Sessions loaded:', sessions.length);
      const sessionsWithJsonMessages = sessions.map(session => ({
        ...session,
        jsonMessages: session.jsonMessages || []
      }));
      loadSessions(sessionsWithJsonMessages);
    });
    unsubscribeFunctions.push(unsubscribeSessionsLoaded);

    const unsubscribeSessionOutput = window.electronAPI.events.onSessionOutput((output: SessionOutput) => {
      console.log(`[useSocket] Received session output for ${output.sessionId}, type: ${output.type}`);
      
      // Get the current state to check if this is the first output for a waiting session
      const state = useSessionStore.getState();
      const session = state.sessions.find(s => s.id === output.sessionId);
      const isActiveSession = state.activeSessionId === output.sessionId;
      
      // Check if this might be the first output for a new session
      if (session && isActiveSession) {
        const hasExistingOutput = (session.output && session.output.length > 0) || 
                                 (session.jsonMessages && session.jsonMessages.length > 0);
        
        if (!hasExistingOutput) {
          console.log(`[useSocket] First output detected for session ${output.sessionId}, triggering reload`);
          // Force a reload of output from the database after a short delay
          // This ensures we get all accumulated output, not just this one event
          setTimeout(() => {
            if (state.activeSessionId === output.sessionId) {
              // Trigger a reload by calling the API directly
              API.sessions.getOutput(output.sessionId).then(response => {
                if (response.success && response.data) {
                  console.log(`[useSocket] Reloaded ${response.data.length} outputs for session ${output.sessionId}`);
                  state.setSessionOutputs(output.sessionId, response.data);
                }
              }).catch(error => {
                console.error(`[useSocket] Failed to reload output for session ${output.sessionId}:`, error);
              });
            }
          }, 500);
        }
      }
      
      // Add output to session store for real-time updates
      addSessionOutput(output);
    });
    unsubscribeFunctions.push(unsubscribeSessionOutput);

    const unsubscribeScriptOutput = window.electronAPI.events.onScriptOutput((output: { sessionId: string; type: 'stdout' | 'stderr'; data: string }) => {
      console.log(`[useSocket] Received script output for ${output.sessionId}`);
      // Store script output in session store for display
      useSessionStore.getState().addScriptOutput(output);
    });
    unsubscribeFunctions.push(unsubscribeScriptOutput);
    
    const unsubscribeOutputAvailable = window.electronAPI.events.onSessionOutputAvailable((info: { sessionId: string }) => {
      console.log(`[useSocket] Output available notification for session ${info.sessionId}`);
      
      // Check if this is the active session that might be waiting for output
      const state = useSessionStore.getState();
      if (state.activeSessionId === info.sessionId) {
        const session = state.sessions.find(s => s.id === info.sessionId);
        
        // If the session has no output in the store, reload from database
        if (session && (!session.output || session.output.length === 0)) {
          console.log(`[useSocket] Active session ${info.sessionId} has no output, triggering reload`);
          
          // Load output from database
          API.sessions.getOutput(info.sessionId).then(response => {
            if (response.success && response.data) {
              console.log(`[useSocket] Loaded ${response.data.length} outputs for session ${info.sessionId}`);
              state.setSessionOutputs(info.sessionId, response.data);
            }
          }).catch(error => {
            console.error(`[useSocket] Failed to load output for session ${info.sessionId}:`, error);
          });
        }
      }
    });
    unsubscribeFunctions.push(unsubscribeOutputAvailable);

    // Load initial sessions
    API.sessions.getAll()
      .then(response => {
        if (response.success && response.data) {
          const sessionsWithJsonMessages = response.data.map((session: Session) => ({
            ...session,
            jsonMessages: session.jsonMessages || []
          }));
          loadSessions(sessionsWithJsonMessages);
        }
      })
      .catch(error => {
        console.error('Failed to load initial sessions:', error);
      });

    return () => {
      // Clean up all event listeners
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [setSessions, loadSessions, addSession, updateSession, deleteSession, addSessionOutput]);
  
  // Return a mock socket object for compatibility
  return {
    connected: true,
    disconnect: () => {},
  };
}