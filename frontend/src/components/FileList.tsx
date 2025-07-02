import React, { memo } from 'react';
import { FileText, FileCode, FileImage, File, Trash2 } from 'lucide-react';

interface FileInfo {
  path: string;
  type: 'added' | 'deleted' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  isBinary?: boolean;
}

interface FileListProps {
  files: FileInfo[];
  onFileClick: (filePath: string, index: number) => void;
  onFileDelete?: (filePath: string) => void;
  selectedFile?: string;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const iconClass = "w-4 h-4 text-gray-600 dark:text-gray-400";
  
  if (!ext) return <File className={iconClass} />;
  
  // Code files
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'swift'].includes(ext)) {
    return <FileCode className={iconClass} />;
  }
  
  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
    return <FileImage className={iconClass} />;
  }
  
  // Text/doc files
  if (['txt', 'md', 'mdx', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini'].includes(ext)) {
    return <FileText className={iconClass} />;
  }
  
  return <File className={iconClass} />;
};

const getTypeColor = (type: FileInfo['type']) => {
  switch (type) {
    case 'added':
      return 'text-green-600 dark:text-green-400';
    case 'deleted':
      return 'text-red-600 dark:text-red-400';
    case 'modified':
      return 'text-blue-600 dark:text-blue-400';
    case 'renamed':
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const getTypeLabel = (type: FileInfo['type']) => {
  switch (type) {
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'modified':
      return 'M';
    case 'renamed':
      return 'R';
    default:
      return '?';
  }
};

export const FileList: React.FC<FileListProps> = memo(({ files, onFileClick, onFileDelete, selectedFile }) => {
  if (files.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        No files changed
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Files Changed ({files.length})
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="py-1">
          {files.map((file, index) => (
            <div
              key={`${file.path}-${index}`}
              className={`w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group ${
                selectedFile === file.path ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <button
                onClick={() => onFileClick(file.path, index)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <span className={`font-mono text-xs font-bold ${getTypeColor(file.type)}`}>
                  {getTypeLabel(file.type)}
                </span>
                {getFileIcon(file.path)}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {file.path}
                </span>
              </button>
              
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                {file.additions > 0 && (
                  <span className="text-xs text-green-600 dark:text-green-400">
                    +{file.additions}
                  </span>
                )}
                {file.deletions > 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    -{file.deletions}
                  </span>
                )}
                {onFileDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (file.type !== 'deleted' && window.confirm(`Are you sure you want to delete ${file.path}?`)) {
                        onFileDelete(file.path);
                      }
                    }}
                    disabled={file.type === 'deleted'}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                      file.type === 'deleted' 
                        ? 'cursor-not-allowed' 
                        : 'hover:bg-red-100 dark:hover:bg-red-900/30'
                    }`}
                    title={file.type === 'deleted' ? 'File already deleted' : 'Delete file'}
                  >
                    <Trash2 className={`w-4 h-4 ${
                      file.type === 'deleted'
                        ? 'text-gray-400 dark:text-gray-600'
                        : 'text-red-600 dark:text-red-400'
                    }`} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

FileList.displayName = 'FileList';