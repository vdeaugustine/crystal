import { create } from 'zustand';
import type { Session, SessionOutput } from '../types/session';
import { API } from '../utils/api';

interface CreateSessionRequest {
  prompt: string;
  worktreeTemplate: string;
  count: number;
}

interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  activeMainRepoSession: Session | null; // Special storage for main repo session
  isLoaded: boolean;
  scriptOutput: Record<string, string[]>; // sessionId -> script output lines
  
  setSessions: (sessions: Session[]) => void;
  loadSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (session: Session) => void;
  deleteSession: (session: Session) => void;
  setActiveSession: (sessionId: string | null) => Promise<void>;
  addSessionOutput: (output: SessionOutput) => void;
  setSessionOutput: (sessionId: string, output: string) => void;
  setSessionOutputs: (sessionId: string, outputs: SessionOutput[]) => void;
  clearSessionOutput: (sessionId: string) => void;
  addScriptOutput: (output: { sessionId: string; type: 'stdout' | 'stderr'; data: string }) => void;
  clearScriptOutput: (sessionId: string) => void;
  getScriptOutput: (sessionId: string) => string[];
  createSession: (request: CreateSessionRequest) => Promise<void>;
  markSessionAsViewed: (sessionId: string) => Promise<void>;
  
  getActiveSession: () => Session | undefined;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeMainRepoSession: null,
  isLoaded: false,
  scriptOutput: {},
  
  setSessions: (sessions) => set({ sessions }),
  
  loadSessions: (sessions) => set({ sessions, isLoaded: true }),
  
  addSession: (session) => set((state) => {
    console.log(`[SessionStore] Adding new session ${session.id} and setting as active`);
    return {
      sessions: [session, ...state.sessions],  // Add new sessions at the top
      activeSessionId: session.id  // Automatically set as active
    };
  }),
  
  updateSession: (updatedSession) => set((state) => {
    // If this is the active main repo session, update it
    if (state.activeMainRepoSession && state.activeMainRepoSession.id === updatedSession.id) {
      return {
        ...state,
        activeMainRepoSession: {
          ...updatedSession,
          output: state.activeMainRepoSession.output,
          jsonMessages: state.activeMainRepoSession.jsonMessages
        }
      };
    }
    
    // Otherwise update in regular sessions
    return {
      sessions: state.sessions.map(session => 
        session.id === updatedSession.id 
          ? { ...updatedSession, output: session.output, jsonMessages: session.jsonMessages } // Preserve existing output and messages
          : session
      )
    };
  }),
  
  deleteSession: (deletedSession) => set((state) => ({
    sessions: state.sessions.filter(session => session.id !== deletedSession.id),
    activeSessionId: state.activeSessionId === deletedSession.id ? null : state.activeSessionId
  })),
  
  setActiveSession: async (sessionId) => {
    if (!sessionId) {
      set({ activeSessionId: null, activeMainRepoSession: null });
      return;
    }
    
    // First check if this is a main repo session by fetching it
    try {
      const response = await API.sessions.get(sessionId);
      if (response.success && response.data) {
        const session = response.data;
        if (session.isMainRepo) {
          // Store main repo session separately with initialized arrays
          set({ 
            activeSessionId: sessionId, 
            activeMainRepoSession: {
              ...session,
              output: session.output || [],
              jsonMessages: session.jsonMessages || []
            }
          });
        } else {
          // Regular session
          set({ activeSessionId: sessionId, activeMainRepoSession: null });
        }
        // Mark session as viewed when it becomes active
        get().markSessionAsViewed(sessionId);
      }
    } catch (error) {
      console.error('Error setting active session:', error);
      set({ activeSessionId: sessionId, activeMainRepoSession: null });
    }
  },
  
  addSessionOutput: (output) => set((state) => {
    console.log(`[SessionStore] Adding output for session ${output.sessionId}, type: ${output.type}`);
    
    // Check if this is for the active main repo session
    if (state.activeMainRepoSession && state.activeMainRepoSession.id === output.sessionId) {
      const session = state.activeMainRepoSession;
      
      if (output.type === 'json') {
        // Update jsonMessages array
        const newJsonMessages = session.jsonMessages || [];
        newJsonMessages.push({...output.data, timestamp: output.timestamp});
        return { 
          ...state,
          activeMainRepoSession: { ...session, jsonMessages: newJsonMessages }
        };
      } else {
        // Add stdout/stderr to output array
        const newOutput = [...session.output];
        newOutput.push(output.data);
        return {
          ...state,
          activeMainRepoSession: { ...session, output: newOutput }
        };
      }
    }
    
    // Otherwise handle regular sessions
    const sessionIndex = state.sessions.findIndex(s => s.id === output.sessionId);
    if (sessionIndex === -1) return state;
    
    const sessions = [...state.sessions];
    const session = sessions[sessionIndex];
    
    if (output.type === 'json') {
      // Update jsonMessages array
      const newJsonMessages = session.jsonMessages || [];
      newJsonMessages.push({...output.data, timestamp: output.timestamp});
      sessions[sessionIndex] = { ...session, jsonMessages: newJsonMessages };
    } else {
      // Add stdout/stderr to output array
      const newOutput = [...session.output];
      newOutput.push(output.data);
      sessions[sessionIndex] = { ...session, output: newOutput };
    }
    
    return { sessions };
  }),
  
  setSessionOutput: (sessionId, output) => set((state) => {
    // Check if this is for the active main repo session
    if (state.activeMainRepoSession && state.activeMainRepoSession.id === sessionId) {
      return {
        ...state,
        activeMainRepoSession: { ...state.activeMainRepoSession, output: [output] }
      };
    }
    
    return {
      sessions: state.sessions.map(session => 
        session.id === sessionId
          ? { ...session, output: [output] }
          : session
      )
    };
  }),
  
  setSessionOutputs: (sessionId, outputs) => set((state) => {
    // Separate outputs and JSON messages
    const stdOutputs: string[] = [];
    const jsonMessages: any[] = [];
    
    outputs.forEach(output => {
      if (output.type === 'json') {
        jsonMessages.push({ ...output.data, timestamp: output.timestamp });
      } else if (output.type === 'stdout' || output.type === 'stderr') {
        stdOutputs.push(output.data);
      }
    });
    
    // Check if this is for the active main repo session
    if (state.activeMainRepoSession && state.activeMainRepoSession.id === sessionId) {
      return {
        ...state,
        activeMainRepoSession: { ...state.activeMainRepoSession, output: stdOutputs, jsonMessages }
      };
    }
    
    return {
      sessions: state.sessions.map(session => {
        if (session.id === sessionId) {
          return { ...session, output: stdOutputs, jsonMessages };
        }
        return session;
      })
    };
  }),
  
  clearSessionOutput: (sessionId) => set((state) => {
    // Check if this is for the active main repo session
    if (state.activeMainRepoSession && state.activeMainRepoSession.id === sessionId) {
      return {
        ...state,
        activeMainRepoSession: { ...state.activeMainRepoSession, output: [], jsonMessages: [] }
      };
    }
    
    return {
      sessions: state.sessions.map(session => 
        session.id === sessionId
          ? { ...session, output: [], jsonMessages: [] }
          : session
      )
    };
  }),
  
  createSession: async (request) => {
    try {
      const response = await API.sessions.create(request);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create session');
      }

      // Sessions will be added via IPC events, no need to manually add here
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },
  
  addScriptOutput: (output) => set((state) => ({
    scriptOutput: {
      ...state.scriptOutput,
      [output.sessionId]: [
        ...(state.scriptOutput[output.sessionId] || []),
        output.data
      ]
    }
  })),

  clearScriptOutput: (sessionId: string) => set((state) => ({
    scriptOutput: {
      ...state.scriptOutput,
      [sessionId]: []
    }
  })),

  getScriptOutput: (sessionId) => {
    const state = get();
    return state.scriptOutput[sessionId] || [];
  },
  
  getActiveSession: () => {
    const state = get();
    // If we have a main repo session, return it
    if (state.activeMainRepoSession && state.activeMainRepoSession.id === state.activeSessionId) {
      return state.activeMainRepoSession;
    }
    // Otherwise look in regular sessions
    return state.sessions.find(session => session.id === state.activeSessionId);
  },

  markSessionAsViewed: async (sessionId) => {
    try {
      const response = await API.sessions.markViewed(sessionId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to mark session as viewed');
      }

      // Session will be updated via IPC events, no need to manually update here
    } catch (error) {
      console.error('Error marking session as viewed:', error);
    }
  }
}));