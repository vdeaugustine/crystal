import React, { useState, useEffect } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import type { DiffViewerProps } from '../types/diff';

const DiffViewer: React.FC<DiffViewerProps> = ({ diff, className = '' }) => {
  const [viewType, setViewType] = useState<'unified' | 'split'>('split');
  
  // Load saved preference from localStorage
  useEffect(() => {
    const savedViewType = localStorage.getItem('diffViewType');
    if (savedViewType === 'split' || savedViewType === 'unified') {
      setViewType(savedViewType);
    }
  }, []);
  
  // Save preference when it changes
  const handleViewTypeChange = (type: 'unified' | 'split') => {
    setViewType(type);
    localStorage.setItem('diffViewType', type);
  };
  
  if (!diff || diff.trim() === '') {
    return (
      <div className={`p-4 text-gray-500 dark:text-gray-400 text-center ${className}`}>
        No changes to display
      </div>
    );
  }

  try {
    // Parse the unified diff to extract individual files
    const files = parseUnifiedDiff(diff);

    if (files.length === 0) {
      return (
        <div className={`p-4 text-gray-500 dark:text-gray-400 text-center ${className}`}>
          No changes to display
        </div>
      );
    }
    
    // Dark mode styles for react-diff-viewer - toned down colors
    const darkStyles = {
      variables: {
        dark: {
          diffViewerBackground: '#1f2937',
          diffViewerColor: '#e5e7eb',
          addedBackground: '#1e4e3a',
          addedColor: '#86efac',
          removedBackground: '#4c1d1d',
          removedColor: '#fca5a5',
          wordAddedBackground: '#166534',
          wordRemovedBackground: '#7f1d1d',
          addedGutterBackground: '#1e4e3a',
          removedGutterBackground: '#4c1d1d',
          gutterBackground: '#374151',
          gutterBackgroundDark: '#374151',
          highlightBackground: '#fbbf24',
          highlightGutterBackground: '#f59e0b',
          codeFoldGutterBackground: '#21232c',
          codeFoldBackground: '#262831',
          emptyLineBackground: '#1f2937',
          gutterColor: '#9ca3af',
          addedGutterColor: '#86efac',
          removedGutterColor: '#fca5a5',
          codeFoldContentColor: '#cbd5e1',
          diffViewerTitleBackground: '#2d3748',
          diffViewerTitleColor: '#cbd5e1',
          diffViewerTitleBorderColor: '#4b5563',
        },
      },
    };
    
    const lightStyles = {
      variables: {
        light: {
          diffViewerBackground: '#ffffff',
          diffViewerColor: '#374151',
          addedBackground: '#f0fdf4',
          addedColor: '#166534',
          removedBackground: '#fef2f2',
          removedColor: '#991b1b',
          wordAddedBackground: '#dcfce7',
          wordRemovedBackground: '#fee2e2',
          addedGutterBackground: '#dcfce7',
          removedGutterBackground: '#fee2e2',
          gutterBackground: '#f9fafb',
          gutterBackgroundDark: '#f3f4f6',
          highlightBackground: '#fbbf24',
          highlightGutterBackground: '#f59e0b',
          codeFoldGutterBackground: '#e0e7ff',
          codeFoldBackground: '#f0f4ff',
          emptyLineBackground: '#fafbfc',
          gutterColor: '#6b7280',
          addedGutterColor: '#166534',
          removedGutterColor: '#991b1b',
          codeFoldContentColor: '#6b7280',
          diffViewerTitleBackground: '#f9fafb',
          diffViewerTitleColor: '#6b7280',
          diffViewerTitleBorderColor: '#e5e7eb',
        },
      },
    };
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    const currentStyles = isDarkMode ? darkStyles : lightStyles;

    return (
      <div className={`diff-viewer ${className}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* View toggle - sticky header */}
        <div className="flex justify-end px-4 py-2 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="inline-flex rounded-lg border border-gray-600 bg-gray-700">
            <button
              onClick={() => handleViewTypeChange('unified')}
              className={`px-3 py-1 text-sm font-medium rounded-l-lg transition-colors ${
                viewType === 'unified'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Unified
            </button>
            <button
              onClick={() => handleViewTypeChange('split')}
              className={`px-3 py-1 text-sm font-medium rounded-r-lg transition-colors ${
                viewType === 'split'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Side-by-side
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
        {files.map((file, index) => {
          // For binary files or files with no content
          if (file.isBinary || (!file.oldValue && !file.newValue)) {
            return (
              <div key={`${file.oldFileName}-${file.newFileName}-${index}`} className="mb-6">
                <div className="bg-gray-700 border border-gray-600 rounded px-4 py-2 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {file.type === 'deleted' && (
                        <span className="text-red-600 mr-2">−</span>
                      )}
                      {file.type === 'added' && (
                        <span className="text-green-600 mr-2">+</span>
                      )}
                      {file.type === 'modified' && (
                        <span className="text-blue-600 mr-2">~</span>
                      )}
                      {file.newFileName || file.oldFileName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {file.isBinary ? 'binary' : file.type}
                    </span>
                  </div>
                  {file.type === 'renamed' && file.oldFileName !== file.newFileName && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {file.oldFileName} → {file.newFileName}
                    </div>
                  )}
                </div>
              </div>
            );
          }
          
          return (
            <div key={`${file.oldFileName}-${file.newFileName}-${index}`} className="mb-6">
              {/* File header */}
              <div className="bg-gray-700 border border-gray-600 rounded-t-lg px-4 py-2 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {file.type === 'deleted' && (
                      <span className="text-red-600 mr-2">−</span>
                    )}
                    {file.type === 'added' && (
                      <span className="text-green-600 mr-2">+</span>
                    )}
                    {file.type === 'modified' && (
                      <span className="text-blue-600 mr-2">~</span>
                    )}
                    {file.newFileName || file.oldFileName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {file.type}
                  </span>
                </div>
                {file.type === 'renamed' && file.oldFileName !== file.newFileName && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {file.oldFileName} → {file.newFileName}
                  </div>
                )}
              </div>

              {/* Diff content */}
              <div className="border border-t-0 border-gray-600 rounded-b-lg" style={{ overflow: 'auto', maxHeight: '600px' }}>
                <ReactDiffViewer
                  oldValue={file.oldValue || ''}
                  newValue={file.newValue || ''}
                  splitView={viewType === 'split'}
                  useDarkTheme={isDarkMode}
                  styles={currentStyles}
                  showDiffOnly={false}
                  disableWordDiff={false}
                  hideLineNumbers={false}
                  hideMarkers={viewType === 'split'}
                  leftTitle={file.oldFileName}
                  rightTitle={file.newFileName}
                />
              </div>
            </div>
          );
        })}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error parsing diff:', error);
    return (
      <div className={`p-4 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded ${className}`}>
        <h3 className="font-medium mb-2">Error parsing diff</h3>
        <pre className="text-sm font-mono bg-white dark:bg-gray-800 p-2 rounded border border-gray-300 dark:border-gray-600">
          {diff}
        </pre>
      </div>
    );
  }
};

// Parse unified diff format to extract individual file diffs
function parseUnifiedDiff(diff: string): Array<{
  oldFileName: string;
  newFileName: string;
  oldValue: string;
  newValue: string;
  type: 'added' | 'deleted' | 'modified' | 'renamed';
  isBinary: boolean;
}> {
  const files: Array<{
    oldFileName: string;
    newFileName: string;
    oldValue: string;
    newValue: string;
    type: 'added' | 'deleted' | 'modified' | 'renamed';
    isBinary: boolean;
  }> = [];
  
  // Split by file headers
  const fileMatches = diff.match(/diff --git[\s\S]*?(?=diff --git|$)/g);
  
  if (!fileMatches) {
    return files;
  }
  
  for (const fileContent of fileMatches) {
    // Extract file names
    const fileNameMatch = fileContent.match(/diff --git a\/(.*?) b\/(.*?)\n/);
    if (!fileNameMatch) continue;
    
    const oldFileName = fileNameMatch[1];
    const newFileName = fileNameMatch[2];
    
    // Check if binary
    const isBinary = fileContent.includes('Binary files') || fileContent.includes('GIT binary patch');
    
    // Determine file type
    let type: 'added' | 'deleted' | 'modified' | 'renamed' = 'modified';
    if (fileContent.includes('new file mode')) {
      type = 'added';
    } else if (fileContent.includes('deleted file mode')) {
      type = 'deleted';
    } else if (fileContent.includes('rename from') && fileContent.includes('rename to')) {
      type = 'renamed';
    }
    
    if (isBinary) {
      files.push({
        oldFileName,
        newFileName,
        oldValue: '',
        newValue: '',
        type,
        isBinary: true,
      });
      continue;
    }
    
    // Extract the actual diff content (skip the headers)
    const lines = fileContent.split('\n');
    const diffStartIndex = lines.findIndex(line => line.startsWith('@@'));
    
    if (diffStartIndex === -1) {
      // No actual diff content, might be a mode change or empty file
      files.push({
        oldFileName,
        newFileName,
        oldValue: '',
        newValue: '',
        type,
        isBinary: false,
      });
      continue;
    }
    
    // Build old and new file content from the diff
    const oldLines: string[] = [];
    const newLines: string[] = [];
    
    for (let i = diffStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('@@')) {
        // Skip hunk headers but keep context
        continue;
      } else if (line.startsWith('-')) {
        // Removed line (only in old file)
        oldLines.push(line.substring(1));
      } else if (line.startsWith('+')) {
        // Added line (only in new file)
        newLines.push(line.substring(1));
      } else if (line.startsWith(' ')) {
        // Context line (in both files)
        oldLines.push(line.substring(1));
        newLines.push(line.substring(1));
      } else if (line.startsWith('\\')) {
        // "No newline at end of file" marker - skip
        continue;
      } else if (line === '') {
        // Empty context line
        oldLines.push('');
        newLines.push('');
      }
    }
    
    files.push({
      oldFileName,
      newFileName,
      oldValue: type === 'added' ? '' : oldLines.join('\n'),
      newValue: type === 'deleted' ? '' : newLines.join('\n'),
      type,
      isBinary: false,
    });
  }
  
  return files;
}

export default DiffViewer;