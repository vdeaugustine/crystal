import { useState } from 'react';
import { AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  error: string;
  details?: string;
  command?: string;
}

export function ErrorDialog({ 
  isOpen, 
  onClose, 
  title = "Command Failed", 
  error, 
  details,
  command 
}: ErrorDialogProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  
  if (!isOpen) return null;

  // Check if details are long enough to warrant collapsing
  const shouldCollapse = details && details.length > 500;
  const displayDetails = shouldCollapse && !isDetailsExpanded 
    ? details.substring(0, 400) + '...' 
    : details;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4 overflow-y-auto">
          <div>
            <p className="text-gray-700 dark:text-gray-300">{error}</p>
          </div>
          
          {command && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Command:</h4>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm text-gray-800 dark:text-gray-300 font-mono overflow-x-auto border border-gray-200 dark:border-gray-700">
                {command}
              </pre>
            </div>
          )}
          
          {details && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Error Details:</h4>
                {shouldCollapse && (
                  <button
                    onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1"
                  >
                    {isDetailsExpanded ? (
                      <>
                        <span>Show less</span>
                        <ChevronUp className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        <span>Show more</span>
                        <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>
                )}
              </div>
              <pre className="bg-red-50 dark:bg-gray-900 p-3 rounded text-sm text-red-700 dark:text-red-400 font-mono overflow-x-auto whitespace-pre-wrap border border-red-200 dark:border-gray-700">
                {displayDetails}
              </pre>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}