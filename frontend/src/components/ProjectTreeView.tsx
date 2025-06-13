import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Settings } from 'lucide-react';
import { useSessionStore } from '../stores/sessionStore';
import { useErrorStore } from '../stores/errorStore';
import { SessionListItem } from './SessionListItem';
import { CreateSessionDialog } from './CreateSessionDialog';
import ProjectSettings from './ProjectSettings';
import { API } from '../utils/api';
import type { Session } from '../types/session';
import type { Project } from '../types/project';

interface ProjectWithSessions extends Project {
  sessions: Session[];
}

export function ProjectTreeView() {
  const [projectsWithSessions, setProjectsWithSessions] = useState<ProjectWithSessions[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProjectForCreate, setSelectedProjectForCreate] = useState<Project | null>(null);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [selectedProjectForSettings, setSelectedProjectForSettings] = useState<Project | null>(null);
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', path: '', mainBranch: 'main', buildScript: '' });
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const { showError } = useErrorStore();

  useEffect(() => {
    loadProjectsWithSessions();
    
    // Set up event listeners for session updates
    const handleSessionCreated = () => {
      loadProjectsWithSessions();
    };
    
    const handleSessionUpdated = () => {
      loadProjectsWithSessions();
    };
    
    const handleSessionDeleted = () => {
      loadProjectsWithSessions();
    };
    
    // Listen for IPC events
    if (window.electronAPI?.events) {
      const unsubscribeCreated = window.electronAPI.events.onSessionCreated(handleSessionCreated);
      const unsubscribeUpdated = window.electronAPI.events.onSessionUpdated(handleSessionUpdated);
      const unsubscribeDeleted = window.electronAPI.events.onSessionDeleted(handleSessionDeleted);
      
      return () => {
        unsubscribeCreated();
        unsubscribeUpdated();
        unsubscribeDeleted();
      };
    }
  }, []);

  const loadProjectsWithSessions = async () => {
    try {
      setIsLoading(true);
      const response = await API.sessions.getAllWithProjects();
      if (response.success && response.data) {
        setProjectsWithSessions(response.data);
        
        // Auto-expand projects that have sessions
        const projectsToExpand = new Set<number>();
        response.data.forEach((project: ProjectWithSessions) => {
          if (project.sessions.length > 0) {
            projectsToExpand.add(project.id);
          }
        });
        setExpandedProjects(projectsToExpand);
        
        // Also expand the project containing the active session
        if (activeSessionId) {
          response.data.forEach((project: ProjectWithSessions) => {
            if (project.sessions.some(s => s.id === activeSessionId)) {
              projectsToExpand.add(project.id);
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to load projects with sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProject = (projectId: number) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleProjectClick = (project: Project) => {
    // Just toggle the expand/collapse state
    toggleProject(project.id);
  };

  const handleCreateSession = (project: Project) => {
    // Just show the dialog for any project
    setSelectedProjectForCreate(project);
    setShowCreateDialog(true);
  };

  const detectCurrentBranch = async (path: string) => {
    if (!path) return;
    
    try {
      const response = await API.projects.detectBranch(path);
      if (response.success && response.data) {
        setNewProject(prev => ({ ...prev, mainBranch: response.data }));
      }
    } catch (error) {
      console.log('Could not detect branch, using default');
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.path) return;

    try {
      const response = await API.projects.create(newProject);

      if (!response.success) {
        showError({
          title: 'Failed to Create Project',
          error: response.error || 'An error occurred while creating the project.',
          details: response.details,
          command: response.command
        });
        return;
      }

      setShowAddProjectDialog(false);
      setNewProject({ name: '', path: '', mainBranch: 'main', buildScript: '' });
      
      // Just reload the projects list
      loadProjectsWithSessions();
    } catch (error: any) {
      console.error('Failed to create project:', error);
      showError({
        title: 'Failed to Create Project',
        error: error.message || 'An error occurred while creating the project.',
        details: error.stack || error.toString()
      });
    }
  };

  if (isLoading) {
    return (
      <div className="px-2 py-4 text-gray-500 text-sm text-center">
        Loading projects...
      </div>
    );
  }

  if (projectsWithSessions.length === 0) {
    return (
      <div className="px-2 py-4 text-gray-500 text-sm text-center">
        No projects yet
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1 px-2 pb-2">
        {projectsWithSessions.map((project) => {
          const isExpanded = expandedProjects.has(project.id);
          const sessionCount = project.sessions.length;
          
          return (
            <div key={project.id}>
              <div 
                className="group flex items-center space-x-1 px-2 py-1.5 rounded cursor-pointer transition-colors hover:bg-gray-700"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProject(project.id);
                  }}
                  className="p-0.5 hover:bg-gray-600 rounded transition-colors"
                  disabled={sessionCount === 0}
                >
                  {sessionCount > 0 ? (
                    isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                    )
                  ) : (
                    <div className="w-3 h-3" />
                  )}
                </button>
                
                <div 
                  className="flex items-center space-x-2 flex-1 min-w-0"
                  onClick={() => handleProjectClick(project)}
                >
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-200 truncate">
                    {project.name}
                  </span>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateSession(project);
                  }}
                  className="p-1 hover:bg-gray-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Create new session"
                >
                  <Plus className="w-4 h-4 text-gray-400 hover:text-gray-200" />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProjectForSettings(project);
                    setShowProjectSettings(true);
                  }}
                  className="p-1 hover:bg-gray-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Project settings"
                >
                  <Settings className="w-3 h-3 text-gray-400 hover:text-gray-200" />
                </button>
              </div>
              
              {isExpanded && sessionCount > 0 && (
                <div className="ml-4 mt-1 space-y-1">
                  {project.sessions.map((session) => (
                    <SessionListItem 
                      key={session.id} 
                      session={session}
                      isNested
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        <button
          onClick={() => setShowAddProjectDialog(true)}
          className="w-full mt-2 px-2 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {showCreateDialog && (
        <CreateSessionDialog
          isOpen={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            setSelectedProjectForCreate(null);
          }}
          projectName={selectedProjectForCreate?.name}
          projectId={selectedProjectForCreate?.id}
        />
      )}
      
      {selectedProjectForSettings && (
        <ProjectSettings
          project={selectedProjectForSettings}
          isOpen={showProjectSettings}
          onClose={() => {
            setShowProjectSettings(false);
            setSelectedProjectForSettings(null);
          }}
          onUpdate={() => {
            loadProjectsWithSessions();
          }}
          onDelete={() => {
            loadProjectsWithSessions();
          }}
        />
      )}
      
      {/* Add Project Dialog */}
      {showAddProjectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Add New Project</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:outline-none focus:border-blue-500"
                  placeholder="My Project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Repository Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProject.path}
                    onChange={(e) => {
                      setNewProject({ ...newProject, path: e.target.value });
                      detectCurrentBranch(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:outline-none focus:border-blue-500"
                    placeholder="/path/to/repository"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await API.dialog.openDirectory({
                        title: 'Select Repository Directory',
                        buttonLabel: 'Select',
                      });
                      if (result.success && result.data) {
                        setNewProject({ ...newProject, path: result.data });
                        detectCurrentBranch(result.data);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Main Branch <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProject.mainBranch}
                    onChange={(e) => setNewProject({ ...newProject, mainBranch: e.target.value })}
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:outline-none focus:border-blue-500"
                    placeholder="main"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => detectCurrentBranch(newProject.path)}
                    disabled={!newProject.path}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Auto-detect
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This must be the branch currently checked out in the folder. Defaults to 'main' for new repos.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Build Script <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newProject.buildScript}
                  onChange={(e) => setNewProject({ ...newProject, buildScript: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., pnpm build or npm run build"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This script will run automatically before each Claude Code session starts.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddProjectDialog(false);
                  setNewProject({ name: '', path: '', mainBranch: 'main', buildScript: '' });
                }}
                className="px-4 py-2 text-gray-300 hover:text-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProject.name || !newProject.path || !newProject.mainBranch}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}