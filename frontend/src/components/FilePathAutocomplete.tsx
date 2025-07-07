import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Folder } from 'lucide-react';

interface FileItem {
  path: string;
  isDirectory: boolean;
  name: string;
}

interface FilePathAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (path: string) => void;
  sessionId?: string;
  projectId?: string;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  isTextarea?: boolean;
  rows?: number;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  style?: React.CSSProperties;
}

const FilePathAutocomplete: React.FC<FilePathAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  sessionId,
  projectId,
  placeholder,
  className,
  textareaRef,
  isTextarea = false,
  rows = 4,
  disabled = false,
  onKeyDown: externalOnKeyDown,
  onPaste,
  style
}) => {
  const [suggestions, setSuggestions] = useState<FileItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activePattern, setActivePattern] = useState<{ start: number; pattern: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the actual ref to use
  const getInputElement = () => {
    if (isTextarea) {
      return textareaRef?.current || internalTextareaRef.current;
    }
    return inputRef.current;
  };

  // Detect @ pattern in the text
  const detectPattern = useCallback((text: string, cursorPos: number) => {
    // Find the last @ before the cursor
    let lastAtIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '@') {
        lastAtIndex = i;
        break;
      }
      // Stop if we hit whitespace or newline
      if (text[i] === ' ' || text[i] === '\n' || text[i] === '\t') {
        break;
      }
    }

    if (lastAtIndex !== -1) {
      // Extract the pattern from @ to cursor
      const pattern = text.substring(lastAtIndex + 1, cursorPos);
      // Check if there's no whitespace after the @
      if (!pattern.includes(' ') && !pattern.includes('\n')) {
        return { start: lastAtIndex, pattern };
      }
    }
    return null;
  }, []);

  // Search for files
  const searchFiles = useCallback(async (pattern: string) => {
    if (!sessionId && !projectId) return;

    try {
      const result = await window.electronAPI?.invoke('file:search', {
        sessionId,
        projectId: typeof projectId === 'string' ? parseInt(projectId, 10) : projectId,
        pattern,
        limit: 20
      });

      if (result.success && result.files) {
        setSuggestions(result.files);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Error searching files:', error);
      setSuggestions([]);
    }
  }, [sessionId, projectId]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check for @ pattern
    const pattern = detectPattern(newValue, cursorPos);
    setActivePattern(pattern);

    if (pattern) {
      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounce the search
      searchTimeoutRef.current = setTimeout(() => {
        searchFiles(pattern.pattern);
        setShowSuggestions(true);
      }, 200);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Handle selection change (cursor movement)
  const handleSelectionChange = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const cursorPos = target.selectionStart || 0;
    setCursorPosition(cursorPos);

    // Check if cursor is still within an @ pattern
    const pattern = detectPattern(value, cursorPos);
    setActivePattern(pattern);

    if (!pattern) {
      setShowSuggestions(false);
    }
  };

  // Select a suggestion
  const selectSuggestion = (suggestion: FileItem) => {
    if (!activePattern) return;

    // Replace the pattern with the selected file path
    const before = value.substring(0, activePattern.start);
    const after = value.substring(cursorPosition);
    const newValue = before + '@' + suggestion.path + after;
    
    onChange(newValue);
    setShowSuggestions(false);
    setSuggestions([]);
    setActivePattern(null);

    // Set cursor position after the inserted path
    const newCursorPos = activePattern.start + suggestion.path.length + 1;
    setTimeout(() => {
      const element = getInputElement();
      if (element) {
        element.focus();
        element.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);

    // Call onSelect callback if provided
    if (onSelect) {
      onSelect(suggestion.path);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    // If we have suggestions and it's a navigation key, handle it
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % suggestions.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
          return;
        case 'Enter':
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            // Allow normal enter behavior with modifiers, pass to external handler
            break;
          }
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
          return;
        case 'Tab':
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
          return;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          return;
      }
    }

    // Pass through to external handler if provided
    if (externalOnKeyDown) {
      externalOnKeyDown(e);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        const element = getInputElement();
        if (element && !element.contains(event.target as Node)) {
          setShowSuggestions(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [textareaRef]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const inputProps = {
    value,
    onChange: handleChange,
    onSelect: handleSelectionChange,
    onKeyDown: handleKeyDown,
    onPaste,
    placeholder,
    className,
    disabled,
    style
  };

  return (
    <div className="relative">
      {isTextarea ? (
        <textarea
          ref={textareaRef || internalTextareaRef}
          {...inputProps}
          rows={rows}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          {...inputProps}
        />
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5"
          style={{
            minWidth: '200px',
            maxWidth: '400px'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.path}
              className={`flex items-center px-3 py-2 cursor-pointer ${
                index === selectedIndex
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {suggestion.isDirectory ? (
                <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
              ) : (
                <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
              )}
              <span className="text-sm truncate">{suggestion.path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilePathAutocomplete;
