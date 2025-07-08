import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../contexts/ThemeContext';
import { MermaidRenderer } from './MermaidRenderer';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  id?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className = '' }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [mermaidKey, setMermaidKey] = useState(0);

  // Force re-render of mermaid diagrams when content changes
  useEffect(() => {
    setMermaidKey(prev => prev + 1);
  }, [content]);

  return (
    <div className={`markdown-preview ${isDarkMode ? 'markdown-dark' : 'markdown-light'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');
            
            // Check if this is an inline code element
            const inline = !className || !className.includes('language-');

            if (!inline && language === 'mermaid') {
              return (
                <MermaidRenderer 
                  key={`mermaid-${mermaidKey}-${codeString.substring(0, 20)}`}
                  chart={codeString} 
                  id={`preview-${Date.now()}`} 
                />
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Style other markdown elements
          h1: ({ children }) => <h1 className="text-3xl font-bold mt-6 mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-bold mt-5 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-bold mt-4 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-lg font-bold mt-3 mb-2">{children}</h4>,
          p: ({ children }) => <p className="mb-4">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 ml-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 ml-4">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          hr: () => <hr className="my-6 border-gray-300 dark:border-gray-600" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};