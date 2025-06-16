import React from 'react';
import { GitCommands } from '../../types/session';

interface CommitMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dialogType: 'squash' | 'rebase';
  gitCommands: GitCommands | null;
  commitMessage: string;
  setCommitMessage: (message: string) => void;
  shouldSquash: boolean;
  setShouldSquash: (should: boolean) => void;
  onConfirm: (message: string) => void;
  isMerging: boolean;
}

export const CommitMessageDialog: React.FC<CommitMessageDialogProps> = ({
  isOpen,
  onClose,
  dialogType,
  gitCommands,
  commitMessage,
  setCommitMessage,
  shouldSquash,
  setShouldSquash,
  onConfirm,
  isMerging,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {dialogType === 'squash'
              ? `Squash and Rebase to ${gitCommands?.mainBranch || 'Main'}`
              : `Rebase from ${gitCommands?.mainBranch || 'Main'}`
            }
          </h2>
          <button onClick={onClose} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {dialogType === 'squash' && (
              <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="shouldSquash"
                  checked={shouldSquash}
                  onChange={(e) => setShouldSquash(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                />
                <label htmlFor="shouldSquash" className="flex-1 cursor-pointer">
                  <div className="font-medium text-gray-900 dark:text-gray-100">Squash commits</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {shouldSquash ? "Combine all commits into a single commit" : "Keep all commits and preserve history"}
                  </div>
                </label>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Commit Message</label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={8}
                disabled={dialogType === 'squash' && !shouldSquash}
                className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${dialogType === 'squash' && !shouldSquash ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'} placeholder-gray-500 dark:placeholder-gray-400`}
                placeholder={dialogType === 'squash' ? (shouldSquash ? "Enter commit message..." : "Not needed when preserving commits") : "Enter commit message..."}
              />
               <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {dialogType === 'squash'
                  ? (shouldSquash 
                      ? `This message will be used for the single squashed commit.`
                      : `Original commit messages will be preserved.`)
                  : `This message will be used when rebasing.`
                }
              </p>
            </div>

            {dialogType === 'squash' && (
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Git commands to be executed:</h4>
                <div className="space-y-1">
                  {shouldSquash ? (
                    gitCommands?.squashCommands?.map((cmd, idx) => (
                      <div key={idx} className="font-mono text-xs bg-gray-800 text-white px-3 py-2 rounded">{cmd}</div>
                    ))
                  ) : (
                    <>
                      <div className="font-mono text-xs bg-gray-800 text-white px-3 py-2 rounded">git checkout {gitCommands?.mainBranch || 'main'}</div>
                      <div className="font-mono text-xs bg-gray-800 text-white px-3 py-2 rounded">git rebase {gitCommands?.currentBranch || 'feature-branch'}</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">Cancel</button>
          <button
            onClick={() => onConfirm(commitMessage)}
            disabled={(shouldSquash && !commitMessage.trim()) || isMerging}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
          >
            {isMerging ? 'Processing...' : (dialogType === 'squash' ? (shouldSquash ? 'Squash & Rebase' : 'Rebase') : 'Rebase')}
          </button>
        </div>
      </div>
    </div>
  );
}; 