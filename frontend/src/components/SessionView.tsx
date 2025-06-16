import { useRef, useEffect, useState, memo } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { JsonMessageView } from './JsonMessageView';
import { EmptyState } from './EmptyState';
import CombinedDiffView from './CombinedDiffView';
import { StravuFileSearch } from './StravuFileSearch';
import { Inbox } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useSessionView } from '../hooks/useSessionView';
import { SessionHeader } from './session/SessionHeader';
import { SessionInputWithImages } from './session/SessionInputWithImages';
import { GitErrorDialog } from './session/GitErrorDialog';
import { CommitMessageDialog } from './session/CommitMessageDialog';
import { PromptNavigation } from './PromptNavigation';
import { isDocumentVisible } from '../utils/performanceUtils';

export const SessionView = memo(() => {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const activeMainRepoSession = useSessionStore((state) => state.activeMainRepoSession);
  const [animationsEnabled, setAnimationsEnabled] = useState(isDocumentVisible());

  useEffect(() => {
    const handleVisibilityChange = () => {
      setAnimationsEnabled(isDocumentVisible());
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  const activeSession = activeSessionId 
    ? (activeMainRepoSession && activeMainRepoSession.id === activeSessionId 
        ? activeMainRepoSession 
        : sessions.find(s => s.id === activeSessionId))
    : undefined;

  const terminalRef = useRef<HTMLDivElement>(null);
  const scriptTerminalRef = useRef<HTMLDivElement>(null);

  const hook = useSessionView(activeSession, terminalRef, scriptTerminalRef);

  if (!activeSession) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
        <EmptyState
          icon={Inbox}
          title="No Session Selected"
          description="Select a session from the sidebar to view its output, or create a new session to get started."
          className="flex-1"
        />
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      <SessionHeader
        activeSession={activeSession}
        isEditingName={hook.isEditingName}
        editName={hook.editName}
        setEditName={hook.setEditName}
        handleNameKeyDown={hook.handleNameKeyDown}
        handleSaveEditName={hook.handleSaveEditName}
        handleStartEditName={hook.handleStartEditName}
        isPathCollapsed={hook.isPathCollapsed}
        setIsPathCollapsed={hook.setIsPathCollapsed}
        isMerging={hook.isMerging}
        handleGitPull={hook.handleGitPull}
        handleGitPush={hook.handleGitPush}
        handleRebaseMainIntoWorktree={hook.handleRebaseMainIntoWorktree}
        hasChangesToRebase={hook.hasChangesToRebase}
        gitCommands={hook.gitCommands}
        handleSquashAndRebaseToMain={hook.handleSquashAndRebaseToMain}
        handleOpenIDE={hook.handleOpenIDE}
        mergeError={hook.mergeError}
        viewMode={hook.viewMode}
        setViewMode={hook.setViewMode}
        unreadActivity={hook.unreadActivity}
        setUnreadActivity={hook.setUnreadActivity}
      />
      
      <div className="flex-1 flex relative min-h-0">
        <div className="flex-1 relative">
          {hook.isLoadingOutput && (
            <div className="absolute top-4 left-4 text-gray-600 dark:text-gray-400 z-10">Loading output...</div>
          )}
          <div className={`bg-gray-50 dark:bg-black h-full ${hook.viewMode === 'output' ? 'block' : 'hidden'} relative`}>
            <div ref={terminalRef} className="h-full" />
            {hook.loadError && hook.viewMode === 'output' && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                  <p className="text-gray-700 dark:text-gray-300 mb-2">Failed to load output content</p>
                  <p className="text-gray-600 dark:text-gray-500 text-sm mb-4">{hook.loadError}</p>
                  <button onClick={() => hook.loadOutputContent(activeSession.id)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Reload Output
                  </button>
                </div>
              </div>
            )}
            {(activeSession.status === 'running' || activeSession.status === 'initializing') && (
              <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                    <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                            <div className={`w-2 h-2 bg-blue-400 rounded-full ${animationsEnabled ? 'animate-typing-dot' : ''}`}></div>
                            <div className={`w-2 h-2 bg-blue-400 rounded-full ${animationsEnabled ? 'animate-typing-dot' : ''}`} style={{ animationDelay: '0.2s' }}></div>
                            <div className={`w-2 h-2 bg-blue-400 rounded-full ${animationsEnabled ? 'animate-typing-dot' : ''}`} style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <span className="text-sm font-medium">
                            {activeSession.status === 'initializing' ? 'Starting Claude Code...' : 'Claude is working...'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                            {activeSession.status === 'initializing' ? '⚡' : hook.formatElapsedTime(hook.elapsedTime)}
                        </div>
                        <button onClick={hook.handleStopSession} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md">
                            Cancel
                        </button>
                    </div>
                </div>
              </div>
            )}
          </div>
          <div className={`h-full ${hook.viewMode === 'messages' ? 'block' : 'hidden'}`}>
            <JsonMessageView messages={activeSession.jsonMessages || []} />
          </div>
          <div className={`h-full ${hook.viewMode === 'changes' ? 'block' : 'hidden'} overflow-hidden`}>
            {hook.viewMode === 'changes' && (
              <CombinedDiffView 
                sessionId={activeSession.id} 
                selectedExecutions={[]} 
                isGitOperationRunning={hook.isMerging}
                isMainRepo={activeSession.isMainRepo}
              />
            )}
          </div>
          <div className={`h-full ${hook.viewMode === 'terminal' ? 'block' : 'hidden'} bg-gray-50 dark:bg-black`}>
            <div ref={scriptTerminalRef} className="h-full" />
          </div>
        </div>
        {hook.viewMode === 'output' && (
          <PromptNavigation 
            sessionId={activeSession.id} 
            onNavigateToPrompt={hook.handleNavigateToPrompt}
          />
        )}
      </div>
      
      <SessionInputWithImages
        activeSession={activeSession}
        viewMode={hook.viewMode}
        input={hook.input}
        setInput={hook.setInput}
        textareaRef={hook.textareaRef}
        handleTerminalCommand={hook.handleTerminalCommand}
        handleSendInput={hook.handleSendInput}
        handleContinueConversation={hook.handleContinueConversation}
        isStravuConnected={hook.isStravuConnected}
        setShowStravuSearch={hook.setShowStravuSearch}
        ultrathink={hook.ultrathink}
        setUltrathink={hook.setUltrathink}
      />

      <CommitMessageDialog
        isOpen={hook.showCommitMessageDialog}
        onClose={() => hook.setShowCommitMessageDialog(false)}
        dialogType={hook.dialogType}
        gitCommands={hook.gitCommands}
        commitMessage={hook.commitMessage}
        setCommitMessage={hook.setCommitMessage}
        shouldSquash={hook.shouldSquash}
        setShouldSquash={hook.setShouldSquash}
        onConfirm={hook.performSquashWithCommitMessage}
        isMerging={hook.isMerging}
      />

      <GitErrorDialog
        isOpen={hook.showGitErrorDialog}
        onClose={() => hook.setShowGitErrorDialog(false)}
        errorDetails={hook.gitErrorDetails}
        formatGitOutput={hook.formatGitOutput}
        getGitErrorTips={hook.getGitErrorTips}
        onAbortAndUseClaude={hook.handleAbortRebaseAndUseClaude}
      />

      <StravuFileSearch
        isOpen={hook.showStravuSearch}
        onClose={() => hook.setShowStravuSearch(false)}
        onFileSelect={hook.handleStravuFileSelect}
      />
    </div>
  );
});

SessionView.displayName = 'SessionView';