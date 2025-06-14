import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useNotifications } from './hooks/useNotifications';
import { useResizable } from './hooks/useResizable';
import { Sidebar } from './components/Sidebar';
import { SessionView } from './components/SessionView';
import { PromptHistory } from './components/PromptHistory';
import Help from './components/Help';
import Welcome from './components/Welcome';
import { AboutDialog } from './components/AboutDialog';
import { UpdateDialog } from './components/UpdateDialog';
import { MainProcessLogger } from './components/MainProcessLogger';
import { ErrorDialog } from './components/ErrorDialog';
import { PermissionDialog } from './components/PermissionDialog';
import { useErrorStore } from './stores/errorStore';
import { useSessionStore } from './stores/sessionStore';
import { API } from './utils/api';

type ViewMode = 'sessions' | 'prompts';

interface PermissionRequest {
  id: string;
  sessionId: string;
  toolName: string;
  input: any;
  timestamp: number;
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [updateVersionInfo, setUpdateVersionInfo] = useState<any>(null);
  const [currentPermissionRequest, setCurrentPermissionRequest] = useState<PermissionRequest | null>(null);
  const { currentError, clearError } = useErrorStore();
  const { sessions, isLoaded } = useSessionStore();
  
  const { width: sidebarWidth, startResize } = useResizable({
    defaultWidth: 320,  // Increased from 256px (w-64)
    minWidth: 200,
    maxWidth: 600,
    storageKey: 'crystal-sidebar-width'
  });
  
  useSocket();
  const { showNotification } = useNotifications();

  useEffect(() => {
    // Show welcome screen intelligently based on user state
    const checkInitialState = async () => {
      const hideWelcome = localStorage.getItem('crystal-hide-welcome');
      const hasSeenWelcome = localStorage.getItem('crystal-welcome-shown');
      
      if (!hideWelcome && isLoaded) {
        try {
          const projectsResponse = await API.projects.getAll();
          const hasProjects = projectsResponse.success && projectsResponse.data && projectsResponse.data.length > 0;
          const hasSessions = sessions.length > 0;
          
          // Show welcome if:
          // 1. First time user (no projects and never seen welcome)
          // 2. Returning user with no active data (no projects and no sessions)
          const isFirstTimeUser = !hasProjects && !hasSeenWelcome;
          const isReturningUserWithNoData = !hasProjects && !hasSessions && hasSeenWelcome;
          
          if (isFirstTimeUser || (isReturningUserWithNoData && !hideWelcome)) {
            setIsWelcomeOpen(true);
            // Mark that welcome has been shown at least once
            localStorage.setItem('crystal-welcome-shown', 'true');
          }
        } catch (error) {
          console.error('Error checking initial state:', error);
        }
      }
    };
    
    if (isLoaded) {
      checkInitialState();
    }
  }, [isLoaded, sessions.length]);
  
  useEffect(() => {
    // Set up permission request listener
    const handlePermissionRequest = (request: PermissionRequest) => {
      console.log('[App] Received permission request:', request);
      setCurrentPermissionRequest(request);
    };
    
    window.electron?.on('permission:request', handlePermissionRequest);
    
    return () => {
      window.electron?.off('permission:request', handlePermissionRequest);
    };
  }, []);

  useEffect(() => {
    // Set up version update listener
    const handleVersionUpdate = (versionInfo: any) => {
      console.log('[App] Version update available:', versionInfo);
      setUpdateVersionInfo(versionInfo);
      setIsUpdateDialogOpen(true);
      showNotification(
        `🚀 Update Available - Crystal v${versionInfo.latest}`,
        'A new version of Crystal is available!',
        '/favicon.ico'
      );
    };
    
    // Set up the listener using the events API
    const removeListener = window.electronAPI.events.onVersionUpdateAvailable(handleVersionUpdate);
    
    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [showNotification]);
  
  const handlePermissionResponse = async (requestId: string, behavior: 'allow' | 'deny', updatedInput?: any, message?: string) => {
    try {
      await API.permissions.respond(requestId, {
        behavior,
        updatedInput,
        message
      });
      setCurrentPermissionRequest(null);
    } catch (error) {
      console.error('Failed to respond to permission request:', error);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      <MainProcessLogger />
      {/* Draggable title bar area */}
      <div 
        className="fixed top-0 left-0 right-0 h-8 z-50 flex items-center justify-end pr-4" 
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
      </div>
      <Sidebar 
        viewMode={viewMode} 
        onViewModeChange={setViewMode} 
        onHelpClick={() => setIsHelpOpen(true)}
        onAboutClick={() => setIsAboutOpen(true)}
        width={sidebarWidth}
        onResize={startResize}
      />
      {viewMode === 'sessions' ? <SessionView /> : <PromptHistory />}
      <Help isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <Welcome isOpen={isWelcomeOpen} onClose={() => setIsWelcomeOpen(false)} />
      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <UpdateDialog 
        isOpen={isUpdateDialogOpen} 
        onClose={() => setIsUpdateDialogOpen(false)}
        versionInfo={updateVersionInfo}
      />
      <ErrorDialog 
        isOpen={!!currentError}
        onClose={clearError}
        title={currentError?.title}
        error={currentError?.error || ''}
        details={currentError?.details}
        command={currentError?.command}
      />
      <PermissionDialog
        request={currentPermissionRequest}
        onRespond={handlePermissionResponse}
        session={currentPermissionRequest ? sessions.find(s => s.id === currentPermissionRequest.sessionId) : undefined}
      />
    </div>
  );
}

export default App;