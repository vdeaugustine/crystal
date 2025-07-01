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
import { DiscordPopup } from './components/DiscordPopup';
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
  const [isDiscordOpen, setIsDiscordOpen] = useState(false);
  const [hasCheckedWelcome, setHasCheckedWelcome] = useState(false);
  const [hasCheckedDiscord, setHasCheckedDiscord] = useState(false);
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
    // This should only run once when the app is loaded, not when sessions change
    const checkInitialState = async () => {
      if (!window.electron?.invoke) {
        console.log('[Welcome Debug] Electron API not available');
        return;
      }
      
      // Get preferences from database
      const hideWelcomeResult = await window.electron.invoke('preferences:get', 'hide_welcome');
      const welcomeShownResult = await window.electron.invoke('preferences:get', 'welcome_shown');
      
      const hideWelcome = hideWelcomeResult?.data === 'true';
      const hasSeenWelcome = welcomeShownResult?.data === 'true';
      
      console.log('[Welcome Debug] Checking welcome screen state:', {
        hideWelcomeRaw: hideWelcomeResult?.data,
        hideWelcome,
        hasSeenWelcome,
        isLoaded
      });
      
      // If user explicitly said "don't show again", respect that preference
      if (hideWelcome) {
        console.log('[Welcome Debug] User has hidden welcome screen, not showing');
        return;
      }
      
      if (isLoaded) {
        try {
          const projectsResponse = await API.projects.getAll();
          const hasProjects = projectsResponse.success && projectsResponse.data && projectsResponse.data.length > 0;
          // Get sessions from the API to avoid stale closure
          const sessionsResponse = await API.sessions.getAll();
          const hasSessions = sessionsResponse.success && sessionsResponse.data && sessionsResponse.data.length > 0;
          
          // Show welcome if:
          // 1. First time user (no projects and never seen welcome)
          // 2. Returning user with no active data (no projects and no sessions)
          const isFirstTimeUser = !hasProjects && !hasSeenWelcome;
          const isReturningUserWithNoData = !hasProjects && !hasSessions && hasSeenWelcome;
          
          console.log('[Welcome Debug] Conditions:', {
            hasProjects,
            hasSessions,
            isFirstTimeUser,
            isReturningUserWithNoData
          });
          
          if (isFirstTimeUser || isReturningUserWithNoData) {
            console.log('[Welcome Debug] Showing welcome screen');
            setIsWelcomeOpen(true);
            // Mark that welcome has been shown at least once
            await window.electron.invoke('preferences:set', 'welcome_shown', 'true');
          } else {
            console.log('[Welcome Debug] Not showing welcome screen');
          }
        } catch (error) {
          console.error('Error checking initial state:', error);
        }
      }
    };
    
    if (isLoaded && !hasCheckedWelcome) {
      checkInitialState();
      setHasCheckedWelcome(true);
    }
  }, [isLoaded, hasCheckedWelcome]); // Remove sessions.length from dependencies to prevent re-runs

  useEffect(() => {
    // Track app open and check Discord popup
    const trackAppOpen = async () => {
      if (!isLoaded) return;
      
      // Check if electron API is available
      if (!window.electron?.invoke) {
        console.log('[Discord Debug] Electron API not available yet');
        return;
      }
      
      try {
        // Get preferences from database
        const hideWelcomeResult = await window.electron.invoke('preferences:get', 'hide_welcome');
        const hideDiscordResult = await window.electron.invoke('preferences:get', 'hide_discord');
        
        const hideWelcome = hideWelcomeResult?.data === 'true';
        const hideDiscord = hideDiscordResult?.data === 'true';
        let shouldShowDiscord = false;
        let needsDiscordUpdate = false;
      
        console.log('[Discord Debug] Checking Discord popup:', {
          hideWelcome,
          hideDiscord,
          isWelcomeOpen,
          isLoaded
        });
        
        // First, check if we should show Discord popup BEFORE recording this app open
        if (hideWelcome && !hideDiscord) {
          console.log('[Discord Debug] Welcome is hidden, checking if we should show Discord...');
          // Get the last app open to see if Discord was already shown
          const result = await window.electron.invoke('app:get-last-open');
          console.log('[Discord Debug] Last app open result:', result);
          
          if (result?.success && result.data) {
            const lastOpen = result.data;
            console.log('[Discord Debug] Last app open data:', lastOpen);
          
            // Show Discord popup if:
            // 1. Discord hasn't been shown yet
            // 2. Either the welcome was just hidden (transition from visible to hidden)
            //    OR it's been hidden and we haven't shown Discord yet
            if (!lastOpen.discord_shown) {
              console.log('[Discord Debug] Showing Discord popup!');
              shouldShowDiscord = true;
              setIsDiscordOpen(true);
              // Mark that we're showing the Discord popup
              if (window.electron?.invoke) {
                await window.electron.invoke('app:update-discord-shown');
              }
            } else {
              console.log('[Discord Debug] Not showing Discord popup because:', {
                welcome_hidden: lastOpen.welcome_hidden,
                discord_shown: lastOpen.discord_shown
              });
            }
          } else {
            // No previous app open - this might be the first run after dismissing welcome
            // Show Discord if welcome is now hidden
            console.log('[Discord Debug] No previous app open found, showing Discord popup');
            shouldShowDiscord = true;
            needsDiscordUpdate = true;
            setIsDiscordOpen(true);
            // Don't update discord shown yet since we need to record the app open first
          }
        } else {
          console.log('[Discord Debug] Not checking Discord popup because:', {
            hideWelcome,
            hideDiscord
          });
        }
        
        // Now record this app open
        console.log('[Discord Debug] Recording current app open');
        if (window.electron?.invoke) {
          await window.electron.invoke('app:record-open', hideWelcome, false);
        }
        
        // If we showed Discord popup but didn't update the database yet (no previous app open case)
        if (shouldShowDiscord && needsDiscordUpdate && window.electron?.invoke) {
          console.log('[Discord Debug] Updating Discord shown status for new app open');
          await window.electron.invoke('app:update-discord-shown');
        }
      } catch (error) {
        console.error('[Discord Debug] Error checking Discord popup:', error);
      }
    };
    
    if (isLoaded && !hasCheckedDiscord) {
      trackAppOpen();
      setHasCheckedDiscord(true);
    }
  }, [isLoaded, hasCheckedDiscord]); // Remove isWelcomeOpen to prevent re-runs
  
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
      <DiscordPopup 
        isOpen={isDiscordOpen} 
        onClose={() => setIsDiscordOpen(false)} 
      />
    </div>
  );
}

export default App;