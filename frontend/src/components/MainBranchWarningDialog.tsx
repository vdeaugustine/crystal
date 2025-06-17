import { Plus } from 'lucide-react';

interface MainBranchWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  projectName: string;
  projectId: number;
  mainBranch: string;
}

export function MainBranchWarningDialog({ 
  isOpen, 
  onClose, 
  onContinue, 
  projectName, 
  projectId,
  mainBranch 
}: MainBranchWarningDialogProps) {
  if (!isOpen) return null;

  const handleDontShowAgain = () => {
    const warningKey = `mainBranchWarning_${projectId}`;
    localStorage.setItem(warningKey, 'true');
    onContinue();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg relative shadow-xl border border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          title="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Working in the {mainBranch} branch
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 dark:text-blue-400 text-2xl mt-1">💡</span>
            <div className="flex-1">
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                You're about to create a session in the <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{mainBranch}</span> branch 
                of <span className="font-medium">{projectName}</span>.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                For better workflow management, it's recommended to create worktrees instead. This allows you to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 mb-4">
                <li>Run multiple sessions in parallel without conflicts</li>
                <li>Keep your main branch clean</li>
                <li>Easily manage and compare different approaches</li>
                <li>Avoid creating more commits than intended in your main branch</li>
              </ul>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-3">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <span className="font-medium">⚠️ Note:</span> Working directly in the {mainBranch} branch may result in 
                  multiple intermediate commits as Claude makes changes. Using worktrees allows you to squash 
                  these into a single clean commit before merging.
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <span className="font-medium">Tip:</span> Click the <Plus className="w-4 h-4 inline mx-1" /> button 
                  next to the project name to create a new worktree session.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onContinue}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-md transition-colors"
          >
            Continue to {mainBranch} branch
          </button>
          <button
            onClick={handleDontShowAgain}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Continue and don't ask again
          </button>
        </div>
        
        <button
          onClick={onClose}
          className="w-full mt-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}