import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DiffEditor, type DiffEditorProps, type MonacoDiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { AlertCircle, FileText, Check, Loader2 } from 'lucide-react';
import type { FileDiff } from '../types/diff';
import { debounce } from '../utils/debounce';
import { MonacoErrorBoundary } from './MonacoErrorBoundary';

interface MonacoDiffViewerProps {
  file: FileDiff;
  sessionId: string;
  isDarkMode: boolean;
  viewType: 'split' | 'inline';
  onSave?: () => void;
  isReadOnly?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'pending';

export const MonacoDiffViewer: React.FC<MonacoDiffViewerProps> = ({
  file,
  sessionId,
  isDarkMode,
  viewType,
  onSave,
  isReadOnly = false
}) => {
  const editorRef = useRef<MonacoDiffEditor | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<string>(file.newValue || '');
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticUpdateRef = useRef<boolean>(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [canMountEditor, setCanMountEditor] = useState(false);
  const [isFullContentLoaded, setIsFullContentLoaded] = useState(false);

  // Delay mounting editor to ensure stability
  useEffect(() => {
    // Reset states when important props change
    setCanMountEditor(false);
    setIsEditorReady(false);
    
    const timer = setTimeout(() => {
      setCanMountEditor(true);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      // Don't reset canMountEditor on cleanup to avoid race conditions
    };
  }, [file.path]); // Removed isReadOnly - we'll handle it dynamically

  // Track when full content is loaded
  useEffect(() => {
    // Check if we have full content by looking for the originalDiffNewValue marker
    const hasFullContent = 'originalDiffNewValue' in file && file.originalDiffNewValue !== undefined && file.newValue !== file.originalDiffNewValue;
    setIsFullContentLoaded(hasFullContent);
    console.log('Full content loaded status:', hasFullContent, 'for file:', file.path);
  }, [file]);

  // Get file extension for language detection
  const getLanguage = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'r': 'r',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'ps1': 'powershell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'md': 'markdown',
      'markdown': 'markdown',
      'dockerfile': 'dockerfile',
      'makefile': 'makefile',
      'toml': 'toml',
      'ini': 'ini',
      'conf': 'ini',
      'env': 'ini',
    };
    return languageMap[ext || ''] || 'plaintext';
  };

  const performSave = useCallback(async (content: string) => {
    console.log('Saving file:', { file, sessionId, path: file.path, isFullContentLoaded });

    if (!file.path) {
      setSaveError('File path is missing');
      setSaveStatus('error');
      console.error('File path is undefined:', file);
      return;
    }

    // If we expect full content but don't have it yet, prevent save
    if (!isReadOnly && 'originalDiffNewValue' in file && !isFullContentLoaded) {
      setSaveError('Cannot save: Waiting for full file content to load. Please try again.');
      setSaveStatus('error');
      console.error('Prevented saving before full content is loaded');
      return;
    }

    // Safety check: if we have originalDiffNewValue, it means we tried to load full content
    // but might have failed. Check if the content we're about to save looks like just a diff hunk
    if ('originalDiffNewValue' in file && file.originalDiffNewValue !== undefined) {
      // If newValue is different from originalDiffNewValue, we successfully loaded full content
      const hasFullContent = file.newValue !== file.originalDiffNewValue;
      
      if (!hasFullContent) {
        // We're still using the diff hunk content, not the full file
        // This is dangerous - we should not save partial content
        setSaveError('Cannot save: Only partial file content is loaded. Please refresh the diff view.');
        setSaveStatus('error');
        console.error('Prevented saving partial content. Current content matches original diff hunk, not full file.');
        return;
      }
    }

    // Additional safety check: Look for diff markers that indicate partial content
    const diffMarkers = ['@@', '+++', '---', 'diff --git'];
    const contentLines = content.split('\n');
    const firstFewLines = contentLines.slice(0, 5).join('\n');
    
    // Check if content looks like a diff rather than actual file content
    if (diffMarkers.some(marker => firstFewLines.includes(marker))) {
      setSaveError('Cannot save: Content appears to be a diff, not the full file. Please refresh the diff view.');
      setSaveStatus('error');
      console.error('Prevented saving diff content as file content. Content starts with:', firstFewLines);
      return;
    }

    // Additional check: If file is supposed to be non-empty but content is suspiciously short
    if (file.type === 'modified' && content.length < 50 && file.oldValue && file.oldValue.length > content.length * 2) {
      setSaveError('Cannot save: Content appears incomplete. Please refresh the diff view.');
      setSaveStatus('error');
      console.error('Prevented saving potentially incomplete content. New length:', content.length, 'Old length:', file.oldValue?.length);
      return;
    }

    setSaveStatus('saving');
    setSaveError(null);

    // Final safety check: ensure we're saving to the correct file
    const currentFilePath = file.path;
    
    try {
      console.log('Invoking file:write with:', {
        sessionId,
        filePath: currentFilePath,
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      });
      
      const result = await window.electronAPI.invoke('file:write', {
        sessionId,
        filePath: currentFilePath,
        content
      });

      if (result.success) {
        setSaveStatus('saved');
        // Update the file's newValue to match saved content
        file.newValue = content;
        onSave?.();
        
        // Clear the saved status after 2 seconds
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
        }
        savedTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } else {
        setSaveError(result.error || 'Failed to save file');
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      setSaveError('Failed to save file');
      setSaveStatus('error');
    }
  }, [sessionId, file, onSave, isReadOnly, isFullContentLoaded]);

  // Create debounced save function
  const debouncedSave = useMemo(
    () => debounce(performSave, 1000),
    [performSave]
  );

  const handleEditorDidMount: DiffEditorProps['onMount'] = useCallback((editor: MonacoDiffEditor) => {
    try {
      editorRef.current = editor;
      
      // Get the modified editor (right side)
      const modifiedEditor = editor.getModifiedEditor();
      
      // Store disposables for cleanup
      const disposables: monaco.IDisposable[] = [];
      
      // Mark editor as ready
      setIsEditorReady(true);
    
    // Track changes and auto-save (only if not read-only)
    if (!isReadOnly) {
      const changeDisposable = modifiedEditor.onDidChangeModelContent(() => {
        // Check if editor and model still exist
        if (!editorRef.current || !modifiedEditor.getModel()) {
          return;
        }
        
        try {
          const newContent = modifiedEditor.getValue();
          setCurrentContent(newContent);
          
          // Skip auto-save if this is a programmatic update (e.g., switching commits)
          if (isProgrammaticUpdateRef.current) {
            return;
          }
          
          // Show pending status immediately
          if (newContent !== file.newValue) {
            setSaveStatus('pending');
            setSaveError(null);
            // Only trigger auto-save if we have full content loaded (or if it's not expected)
            if (isFullContentLoaded || !('originalDiffNewValue' in file)) {
              // Trigger debounced save
              debouncedSave(newContent);
            } else {
              console.log('Auto-save skipped: waiting for full content to load');
            }
          }
        } catch (error) {
          console.debug('Error in content change handler:', error);
        }
      });
      disposables.push(changeDisposable);

      // Add save keyboard shortcut for immediate save
      const commandDisposable = modifiedEditor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          // Check if editor and model still exist
          if (!editorRef.current || !modifiedEditor.getModel()) {
            return;
          }
          
          try {
            const content = modifiedEditor.getValue();
            // Cancel any pending debounced save
            debouncedSave.cancel?.();
            performSave(content);
          } catch (error) {
            console.debug('Error in save command:', error);
          }
        }
      );
      if (commandDisposable) {
        disposables.push({ dispose: () => commandDisposable });
      }
    }
    
    // Store disposables for cleanup
    (editor as any).__disposables = disposables;
    } catch (error) {
      console.error('Error mounting Monaco editor:', error);
      setIsEditorReady(false);
      // Try to recover by remounting
      setTimeout(() => {
        setCanMountEditor(false);
        setTimeout(() => setCanMountEditor(true), 100);
      }, 100);
    }
  }, [isReadOnly, debouncedSave, performSave, file.newValue, isFullContentLoaded]);

  // Refresh content when file changes
  useEffect(() => {
    // Set flag to prevent auto-save during programmatic update
    isProgrammaticUpdateRef.current = true;
    
    setCurrentContent(file.newValue || '');
    setSaveStatus('idle');
    setSaveError(null);
    
    // Update the editor content if it exists, is ready, and hasn't been disposed
    if (editorRef.current && isEditorReady) {
      try {
        const modifiedEditor = editorRef.current.getModifiedEditor();
        if (modifiedEditor && modifiedEditor.getModel()) {
          const currentValue = modifiedEditor.getValue();
          
          // Only update if content is different
          if (currentValue !== (file.newValue || '')) {
            modifiedEditor.setValue(file.newValue || '');
          }
        }
      } catch (error) {
        // Editor might have been disposed, ignore the error
        console.debug('Editor update skipped, might be disposed:', error);
      }
    }
    
    // Reset flag after a small delay to ensure the change event has fired
    const timeoutId = setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 100);
    
    // Cleanup timeout on effect cleanup
    return () => clearTimeout(timeoutId);
  }, [file.path, file.newValue, isEditorReady]);

  // Handle readOnly prop changes dynamically
  useEffect(() => {
    if (editorRef.current && isEditorReady) {
      try {
        const modifiedEditor = editorRef.current.getModifiedEditor();
        if (modifiedEditor) {
          modifiedEditor.updateOptions({ readOnly: isReadOnly });
        }
      } catch (error) {
        console.debug('Error updating editor readOnly option:', error);
      }
    }
  }, [isReadOnly, isEditorReady]);

  // Cleanup on unmount or when key props change
  useEffect(() => {
    return () => {
      console.log('MonacoDiffViewer cleanup triggered for file:', file.path);
      // Cancel any pending saves
      debouncedSave.cancel?.();
      
      // Clear timeout
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
      
      // Dispose of the editor to prevent memory leaks and errors
      if (editorRef.current) {
        try {
          // Dispose event handlers first
          const editor = editorRef.current as any;
          if (editor.__disposables) {
            editor.__disposables.forEach((d: monaco.IDisposable) => {
              try {
                d.dispose();
              } catch (error) {
                console.debug('Error disposing event handler:', error);
              }
            });
            editor.__disposables = [];
          }
          
          // Get both editors to ensure proper cleanup
          const originalEditor = editorRef.current.getOriginalEditor();
          const modifiedEditor = editorRef.current.getModifiedEditor();
          
          // Clear models before disposing to prevent the TextModel disposal error
          if (originalEditor && originalEditor.getModel()) {
            originalEditor.setModel(null);
          }
          if (modifiedEditor && modifiedEditor.getModel()) {
            modifiedEditor.setModel(null);
          }
          
          // Then dispose of the diff editor
          editorRef.current.dispose();
          editorRef.current = null;
        } catch (error) {
          console.debug('Error during Monaco editor cleanup:', error);
        }
      }
    };
  }, [debouncedSave, file.path]); // Removed isReadOnly to prevent unnecessary cleanup

  const options: monaco.editor.IStandaloneDiffEditorConstructionOptions = {
    readOnly: isReadOnly,
    renderSideBySide: viewType === 'split',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    automaticLayout: true,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
  };

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'saved':
        return <Check className="w-3 h-3" />;
      case 'error':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return saveError || 'Error';
      case 'pending':
        return 'Auto-save pending...';
      default:
        return '';
    }
  };

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'saved':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {file.path}
          </span>
        </div>
        
        {/* Save Status or Read-only indicator */}
        {isReadOnly ? (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <AlertCircle className="w-3 h-3" />
            <span>Read-only (select all commits to edit)</span>
          </div>
        ) : saveStatus !== 'idle' && (
          <div className={`flex items-center gap-1 text-xs ${getSaveStatusColor()}`}>
            {getSaveStatusIcon()}
            <span>{getSaveStatusText()}</span>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden relative">
        {(!isEditorReady || !canMountEditor) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading editor...</span>
            </div>
          </div>
        )}
        {file.path && canMountEditor && (
          <MonacoErrorBoundary onReset={() => setIsEditorReady(false)}>
            <DiffEditor
              height="100%"
              language={getLanguage(file.path)}
              original={file.oldValue || ''}
              modified={currentContent}
              theme={isDarkMode ? 'vs-dark' : 'vs'}
              options={options}
              onMount={handleEditorDidMount}
            />
          </MonacoErrorBoundary>
        )}
      </div>
    </div>
  );
};