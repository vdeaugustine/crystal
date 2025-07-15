import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from '../utils/formatters';
import { formatDuration, getTimeDifference, isValidTimestamp, parseTimestamp } from '../utils/timestampUtils';

interface PromptMarker {
  id: number;
  session_id: string;
  prompt_text: string;
  output_index: number;
  output_line?: number;
  timestamp: string;
  completion_timestamp?: string;
}

interface PromptDetailModalProps {
  prompt: PromptMarker;
  promptIndex: number;
  onClose: () => void;
}

export function PromptDetailModal({ prompt, promptIndex, onClose }: PromptDetailModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const calculateDuration = (): string => {
    try {
      if (!isValidTimestamp(prompt.timestamp)) {
        return 'Unknown duration';
      }
      
      if (prompt.completion_timestamp && isValidTimestamp(prompt.completion_timestamp)) {
        const durationMs = getTimeDifference(prompt.timestamp, prompt.completion_timestamp);
        if (durationMs < 0) {
          return 'Invalid duration';
        }
        return formatDuration(durationMs);
      }
      
      return 'Duration unavailable';
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 'Unknown duration';
    }
  };

  // Close on escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Prompt #{promptIndex + 1}
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{formatDistanceToNow(parseTimestamp(prompt.timestamp))} ago</span>
              <span className="text-gray-400">•</span>
              <span className="font-medium">{calculateDuration()}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Copy prompt"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
            {prompt.prompt_text}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>Press ESC to close</span>
            <span>Double-click any prompt to view details</span>
          </div>
        </div>
      </div>
    </div>
  );
}