import { useState } from 'react';
import { Settings } from './Settings';
import { ProjectTreeView } from './ProjectTreeView';
import { Info } from 'lucide-react';
import crystalLogo from '../assets/crystal-logo.svg';

type ViewMode = 'sessions' | 'prompts';

interface SidebarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onHelpClick: () => void;
  onAboutClick: () => void;
  width: number;
  onResize: (e: React.MouseEvent) => void;
}

export function Sidebar({ viewMode, onViewModeChange, onHelpClick, onAboutClick, width, onResize }: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div 
        data-testid="sidebar" 
        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white h-full flex flex-col pt-4 relative flex-shrink-0 border-r border-gray-200 dark:border-gray-700"
        style={{ width: `${width}px` }}
      >
        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize group z-10"
          onMouseDown={onResize}
        >
          {/* Visual indicator */}
          <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700 group-hover:bg-blue-500 transition-colors" />
          {/* Larger grab area */}
          <div className="absolute -left-2 -right-2 top-0 bottom-0" />
          {/* Drag indicator dots */}
          <div className="absolute top-1/2 -translate-y-1/2 right-0 transform translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col gap-1">
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
            </div>
          </div>
        </div>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between overflow-hidden">
          <div className="flex items-center space-x-2 min-w-0">
            <img src={crystalLogo} alt="Crystal" className="h-6 w-6 flex-shrink-0" />
            <h1 className="text-xl font-bold truncate">Crystal</h1>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={onHelpClick}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Help"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={onAboutClick}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="About Crystal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              data-testid="settings-button"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>


        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => onViewModeChange('sessions')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                viewMode === 'sessions'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-b-2 border-blue-500'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Sessions
            </button>
            <button
              onClick={() => onViewModeChange('prompts')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                viewMode === 'prompts'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-b-2 border-blue-500'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Prompts
            </button>
          </div>
        </div>


      {viewMode === 'sessions' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          <div className="px-4 py-2 text-sm uppercase flex items-center justify-between overflow-hidden">
            <span className="truncate text-gray-700 dark:text-gray-400">Projects & Sessions</span>
            <div className="group relative">
              <button 
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Status legend"
              >
                <Info className="w-4 h-4" />
              </button>
              {/* Status Legend Tooltip */}
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Session Status Guide</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">Initializing</span>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Setting up git worktree and environment</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">Running</span>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Claude is actively processing your request</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">Waiting</span>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Claude needs your input to continue</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">Completed</span>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Task finished successfully</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">New Activity</span>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Session has new unviewed results</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                      <div>
                        <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">Error</span>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Something went wrong with the session</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Arrow pointing up */}
                <div className="absolute -top-2 right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white dark:border-b-gray-900"></div>
              </div>
            </div>
          </div>
          <ProjectTreeView />
        </div>
      )}
    </div>

      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
