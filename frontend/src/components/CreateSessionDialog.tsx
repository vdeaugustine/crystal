import React, { useState, useEffect } from 'react';
import { API } from '../utils/api';
import type { CreateSessionRequest } from '../types/session';
import { useErrorStore } from '../stores/errorStore';
import { Shield, ShieldOff, Sparkles, GitBranch } from 'lucide-react';

interface CreateSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  projectId?: number;
}

export function CreateSessionDialog({ isOpen, onClose, projectName, projectId }: CreateSessionDialogProps) {
  const [formData, setFormData] = useState<CreateSessionRequest>({
    prompt: '',
    worktreeTemplate: '',
    count: 1,
    permissionMode: 'ignore'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [worktreeError, setWorktreeError] = useState<string | null>(null);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [branches, setBranches] = useState<Array<{ name: string; isCurrent: boolean; hasWorktree: boolean }>>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [ultrathink, setUltrathink] = useState(false);
  const [showWorktreeWarning, setShowWorktreeWarning] = useState(false);
  const [showMainBranchWarning, setShowMainBranchWarning] = useState(false);
  const [mainBranch, setMainBranch] = useState<string>('main');
  const { showError } = useErrorStore();
  
  useEffect(() => {
    if (isOpen) {
      // Fetch the default permission mode and check for API key when dialog opens
      API.config.get().then(response => {
        if (response.success) {
          if (response.data?.defaultPermissionMode) {
            setFormData(prev => ({
              ...prev,
              permissionMode: response.data.defaultPermissionMode
            }));
          }
          // Check if API key exists
          setHasApiKey(!!response.data?.anthropicApiKey);
        }
      }).catch(err => {
        console.error('Failed to fetch config:', err);
      });
      
      // Fetch branches and project details if projectId is provided
      if (projectId) {
        setIsLoadingBranches(true);
        
        // Fetch project details and branches in parallel
        Promise.all([
          API.projects.getAll(),
          API.projects.listBranches(projectId.toString())
        ]).then(([projectsResponse, branchesResponse]) => {
          let projectMainBranch = 'main';
          
          if (projectsResponse.success && projectsResponse.data) {
            const project = projectsResponse.data.find((p: any) => p.id === projectId);
            if (project) {
              projectMainBranch = project.main_branch || 'main';
              setMainBranch(projectMainBranch);
            }
          }
          
          if (branchesResponse.success && branchesResponse.data) {
            setBranches(branchesResponse.data);
            // Set the current branch as default if available
            const currentBranch = branchesResponse.data.find((b: any) => b.isCurrent);
            if (currentBranch && !formData.baseBranch) {
              setFormData(prev => ({ ...prev, baseBranch: currentBranch.name }));
              // Check if the current branch has a worktree
              setShowWorktreeWarning(!!currentBranch.hasWorktree);
              
              // Check if this is main branch and if we should show warning
              if (currentBranch.name === projectMainBranch) {
                // Check if we've shown this warning before
                const warningKey = `mainBranchWarning_${projectId}`;
                const hasShownWarning = localStorage.getItem(warningKey);
                if (!hasShownWarning) {
                  setShowMainBranchWarning(true);
                }
              }
            }
          }
        }).catch(err => {
          console.error('Failed to fetch project/branches:', err);
        }).finally(() => {
          setIsLoadingBranches(false);
        });
      }
    }
  }, [isOpen, projectId]);
  
  if (!isOpen) return null;
  
  const validateWorktreeName = (name: string): string | null => {
    if (!name) return null; // Empty is allowed
    
    // Check for spaces
    if (name.includes(' ')) {
      return 'Session name cannot contain spaces';
    }
    
    // Check for invalid git characters
    const invalidChars = /[~^:?*\[\]\\]/;
    if (invalidChars.test(name)) {
      return 'Session name contains invalid characters (~^:?*[]\\)';
    }
    
    // Check if it starts or ends with dot
    if (name.startsWith('.') || name.endsWith('.')) {
      return 'Session name cannot start or end with a dot';
    }
    
    // Check if it starts or ends with slash
    if (name.startsWith('/') || name.endsWith('/')) {
      return 'Session name cannot start or end with a slash';
    }
    
    // Check for consecutive dots
    if (name.includes('..')) {
      return 'Session name cannot contain consecutive dots';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate worktree name
    const validationError = validateWorktreeName(formData.worktreeTemplate || '');
    if (validationError) {
      showError({
        title: 'Invalid Session Name',
        error: validationError
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Append ultrathink to prompt if checkbox is checked
      const finalPrompt = ultrathink ? formData.prompt + '\nultrathink' : formData.prompt;
      
      const response = await API.sessions.create({
        ...formData,
        prompt: finalPrompt,
        projectId
      });
      
      if (!response.success) {
        showError({
          title: 'Failed to Create Session',
          error: response.error || 'An error occurred while creating the session.',
          details: response.details,
          command: response.command
        });
        return;
      }
      
      onClose();
      // Reset form but fetch the default permission mode again
      const configResponse = await API.config.get();
      const defaultPermissionMode = configResponse.success && configResponse.data?.defaultPermissionMode 
        ? configResponse.data.defaultPermissionMode 
        : 'ignore';
      setFormData({ prompt: '', worktreeTemplate: '', count: 1, permissionMode: defaultPermissionMode as 'ignore' | 'approve' });
      setWorktreeError(null);
      setUltrathink(false);
    } catch (error: any) {
      console.error('Error creating session:', error);
      showError({
        title: 'Failed to Create Session',
        error: error.message || 'An error occurred while creating the session.',
        details: error.stack || error.toString()
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div data-testid="create-session-dialog" className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl relative shadow-xl border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            setWorktreeError(null);
            onClose();
          }}
          className="absolute top-4 right-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          title="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-4 pr-8 text-gray-900 dark:text-white">
          Create New Session{projectName && ` in ${projectName}`}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prompt
            </label>
            <textarea
              id="prompt"
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400"
              rows={4}
              required
              placeholder="Enter the prompt for Claude Code..."
            />
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={ultrathink}
                  onChange={(e) => setUltrathink(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable ultrathink mode
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                Triggers Claude Code to use its maximum thinking token limit. Slower but better for difficult tasks.
              </p>
            </div>
          </div>
          
          <div>
            <label htmlFor="worktreeTemplate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Name (Optional)
            </label>
            <div className="flex gap-2">
              <input
                id="worktreeTemplate"
                type="text"
                value={formData.worktreeTemplate}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, worktreeTemplate: value });
                  // Real-time validation
                  const error = validateWorktreeName(value);
                  setWorktreeError(error);
                }}
                className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 ${
                  worktreeError 
                    ? 'border-red-400 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                }`}
                placeholder="Leave empty for AI-generated name"
                disabled={isGeneratingName}
              />
              {hasApiKey && formData.prompt.trim() && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsGeneratingName(true);
                    try {
                      const response = await API.sessions.generateName(formData.prompt);
                      if (response.success && response.data) {
                        setFormData({ ...formData, worktreeTemplate: response.data });
                        setWorktreeError(null);
                      } else {
                        showError({
                          title: 'Failed to Generate Name',
                          error: response.error || 'Could not generate session name'
                        });
                      }
                    } catch (error) {
                      showError({
                        title: 'Failed to Generate Name',
                        error: 'An error occurred while generating the name'
                      });
                    } finally {
                      setIsGeneratingName(false);
                    }
                  }}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-gray-300 dark:border-gray-600"
                  disabled={isGeneratingName || !formData.prompt.trim()}
                  title="Generate name from prompt"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingName ? 'Generating...' : 'Generate'}
                </button>
              )}
            </div>
            {worktreeError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{worktreeError}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {!worktreeError && 'The name that will be used to label your session and create your worktree folder.'}
            </p>
          </div>
          
          {branches.length > 0 && (
            <div>
              <label htmlFor="baseBranch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base Branch
              </label>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-gray-400" />
                <select
                  id="baseBranch"
                  value={formData.baseBranch || ''}
                  onChange={(e) => {
                    const selectedBranch = e.target.value;
                    setFormData({ ...formData, baseBranch: selectedBranch });
                    // Check if the selected branch has a worktree
                    const branch = branches.find(b => b.name === selectedBranch);
                    setShowWorktreeWarning(!!branch?.hasWorktree);
                    
                    // Check if this is main branch and if we should show warning
                    if (selectedBranch === mainBranch && projectId) {
                      const warningKey = `mainBranchWarning_${projectId}`;
                      const hasShownWarning = localStorage.getItem(warningKey);
                      if (!hasShownWarning) {
                        setShowMainBranchWarning(true);
                      }
                    } else {
                      setShowMainBranchWarning(false);
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  disabled={isLoadingBranches}
                >
                  {branches.map((branch, index) => {
                    // Check if this is the first non-worktree branch after worktree branches
                    const isFirstNonWorktree = index > 0 && 
                      !branch.hasWorktree && 
                      branches[index - 1].hasWorktree;
                    
                    return (
                      <React.Fragment key={branch.name}>
                        {isFirstNonWorktree && (
                          <option disabled value="">
                            ──────────────
                          </option>
                        )}
                        <option value={branch.name}>
                          {branch.name} {branch.isCurrent ? '(current)' : ''}
                        </option>
                      </React.Fragment>
                    );
                  })}
                </select>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Create the new session branch from this existing branch
              </p>
              {showWorktreeWarning && (
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Creating session from worktree branch
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        You're creating a new session based on a branch that already has an active worktree. 
                        This means your new session will branch off from the current state of that worktree, 
                        including any uncommitted changes. Consider committing or stashing changes in the source 
                        worktree first.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {showMainBranchWarning && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 text-lg">💡</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Working in the {mainBranch} branch
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        You're creating a session in the {mainBranch} branch. It's recommended to create worktrees 
                        instead by clicking the <span className="font-mono bg-blue-100 dark:bg-blue-800/30 px-1 rounded">+</span> button 
                        next to the project name. This allows you to run multiple sessions in parallel without conflicts.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMainBranchWarning(false);
                          if (projectId) {
                            const warningKey = `mainBranchWarning_${projectId}`;
                            localStorage.setItem(warningKey, 'true');
                          }
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 underline mt-1 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Don't show this again for this project
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div>
            <label htmlFor="count" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number of Sessions
            </label>
            <input
              id="count"
              type="number"
              min="1"
              max="10"
              value={formData.count}
              onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Creates multiple sessions with numbered suffixes
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permission Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="permissionMode"
                  value="ignore"
                  checked={formData.permissionMode === 'ignore' || !formData.permissionMode}
                  onChange={(e) => setFormData({ ...formData, permissionMode: e.target.value as 'ignore' | 'approve' })}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">Skip Permissions</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(recommended)</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-6 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                    Claude runs with full permissions. Ideal for trusted environments and faster workflows.
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="permissionMode"
                  value="approve"
                  checked={formData.permissionMode === 'approve'}
                  onChange={(e) => setFormData({ ...formData, permissionMode: e.target.value as 'ignore' | 'approve' })}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600 dark:text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">Manual Approval</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(safer)</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-6 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                    Claude asks permission for file operations. Use this for sensitive projects or when learning.
                  </p>
                </div>
              </label>
            </div>
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                <strong>Note:</strong> This setting only affects new sessions. You can change the default in Settings.
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setWorktreeError(null);
                onClose();
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.prompt || !!worktreeError}
              className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors shadow-sm hover:shadow"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                `Create ${(formData.count || 1) > 1 ? (formData.count || 1) + ' Sessions' : 'Session'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}