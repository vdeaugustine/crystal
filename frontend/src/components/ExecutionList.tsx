import React, { useState, memo } from 'react';
import type { ExecutionListProps } from '../types/diff';

const ExecutionList: React.FC<ExecutionListProps> = memo(({
  executions,
  selectedExecutions,
  onSelectionChange
}) => {
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  const handleCommitClick = (executionId: number, event: React.MouseEvent) => {
    if (event.shiftKey && rangeStart !== null) {
      // Range selection with shift-click
      const start = Math.min(rangeStart, executionId);
      const end = Math.max(rangeStart, executionId);
      onSelectionChange([start, end]);
    } else {
      // Single selection
      setRangeStart(executionId);
      onSelectionChange([executionId]);
    }
  };

  const handleSelectAll = () => {
    if (executions.length > 0) {
      // Select from first to last commit (excluding uncommitted if present)
      const firstId = executions[executions.length - 1].id;
      const lastId = executions.find(e => e.id !== 0)?.id || firstId;
      onSelectionChange([firstId, lastId]);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const getStatsDisplay = (exec: { stats_additions: number; stats_deletions: number; stats_files_changed: number }) => {
    const { stats_additions, stats_deletions, stats_files_changed } = exec;
    if (stats_files_changed === 0) {
      return <span className="text-gray-500 dark:text-gray-400 text-sm">No changes</span>;
    }
    
    return (
      <div className="text-sm space-x-3">
        <span className="text-green-600 dark:text-green-400">+{stats_additions}</span>
        <span className="text-red-600 dark:text-red-400">-{stats_deletions}</span>
        <span className="text-gray-600 dark:text-gray-400">{stats_files_changed} {stats_files_changed === 1 ? 'file' : 'files'}</span>
      </div>
    );
  };

  const isInRange = (executionId: number): boolean => {
    if (selectedExecutions.length === 0) return false;
    if (selectedExecutions.length === 1) return selectedExecutions[0] === executionId;
    if (selectedExecutions.length === 2) {
      const [start, end] = selectedExecutions;
      return executionId >= Math.min(start, end) && executionId <= Math.max(start, end);
    }
    return false;
  };

  if (executions.length === 0) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400 text-center">
        No commits found for this session
      </div>
    );
  }

  return (
    <div className="execution-list h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Commits ({executions.filter(e => e.id !== 0).length})
        </h3>
        <button
          onClick={handleSelectAll}
          className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
        >
          Select All Commits
        </button>
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600">
        Click to select a single commit, Shift+Click to select a range
      </div>

      {/* Execution list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {executions.map((execution) => {
          const isSelected = isInRange(execution.id);
          const isUncommitted = execution.id === 0;
          
          return (
            <div
              key={execution.id}
              className={`
                flex items-center p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                ${isSelected ? 'bg-blue-100 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''}
                ${isUncommitted ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''}
              `}
              onClick={(e) => handleCommitClick(execution.id, e)}
            >
              <div className="mr-3 w-4 h-4 flex items-center justify-center">
                {isSelected && (
                  <div className="w-3 h-3 bg-blue-600 rounded-full" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {isUncommitted ? (
                      <span className="text-yellow-700 dark:text-yellow-300">Uncommitted changes</span>
                    ) : (
                      <span>{truncateMessage(execution.prompt_text || `Commit ${execution.execution_sequence}`)}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(execution.timestamp)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    {getStatsDisplay(execution)}
                  </div>
                  
                  {execution.after_commit_hash && execution.after_commit_hash !== 'UNCOMMITTED' && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {execution.after_commit_hash.substring(0, 7)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection summary */}
      {selectedExecutions.length > 0 && (
        <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border-t border-blue-300 dark:border-blue-800">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            {selectedExecutions.length === 1 ? (
              `1 commit selected`
            ) : selectedExecutions.length === 2 ? (
              `Range selected: ${Math.abs(selectedExecutions[1] - selectedExecutions[0]) + 1} commits`
            ) : (
              `${selectedExecutions.length} commits selected`
            )}
          </div>
        </div>
      )}
    </div>
  );
});

ExecutionList.displayName = 'ExecutionList';

export default ExecutionList;