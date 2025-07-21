/*
 * Copyright © 2025 Dell Inc. or its subsidiaries. All Rights Reserved.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *      http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Snackbar,
  Alert,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import VSCodeIconSvg from '../../assets/vscode.svg';
import { getSettings } from '../../utils/settings';
import { DownloadsPathDialog } from './DownloadsPathDialog';

interface MarkdownRendererProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  children: string;
}

interface SnackbarMessage {
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, children }) => {
  const [copied, setCopied] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarMessage | null>(null);
  const [showPathDialog, setShowPathDialog] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const showSnackbar = (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    setSnackbar({ message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      showSnackbar('Code copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showSnackbar('Failed to copy code', 'error');
    }
  };

  const handlePathDialogClose = (path?: string) => {
    setShowPathDialog(false);
    if (path) {
      // Path was saved, now continue with opening VS Code
      openInVSCodeWithPath(path);
    }
  };

  const openInVSCodeWithPath = async (downloadsPath: string) => {
    try {
      const extensionMap: { [key: string]: string } = {
        javascript: 'js',
        typescript: 'ts',
        python: 'py',
        java: 'java',
        csharp: 'cs',
        cpp: 'cpp',
        c: 'c',
        html: 'html',
        css: 'css',
        scss: 'scss',
        json: 'json',
        xml: 'xml',
        yaml: 'yaml',
        yml: 'yml',
        markdown: 'md',
        sql: 'sql',
        shell: 'sh',
        bash: 'sh',
        powershell: 'ps1',
        go: 'go',
        rust: 'rs',
        ruby: 'rb',
        php: 'php',
        swift: 'swift',
        kotlin: 'kt',
        r: 'r',
        jsx: 'jsx',
        tsx: 'tsx',
      };

      const extension = extensionMap[language?.toLowerCase()] || 'txt';
      const timestamp = new Date().getTime();
      const filename = `code-snippet-${timestamp}.${extension}`;

      // Copy to clipboard first
      await handleCopy();

      // Create a Blob and download it
      const blob = new Blob([children], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 100);

      showSnackbar(`Code saved as "${filename}". Opening in VS Code...`, 'success');

      // Try to open VS Code with the full path
      setTimeout(() => {
        // Construct the full file path
        const fullPath = `${downloadsPath}${downloadsPath.endsWith('/') || downloadsPath.endsWith('\\') ? '' : '/'}${filename}`;
        
        // Try to open VS Code with the file
        window.open(`vscode://file/${fullPath}`);
        showSnackbar('VS Code should be opening with your file.', 'info');
      }, 500);
      
    } catch (err) {
      console.error('Failed to save code:', err);
      showSnackbar('Code copied to clipboard. Create a new file in VS Code and paste (Ctrl/Cmd+V)', 'warning');
    }
  };

  const handleOpenInVSCode = async () => {
    try {
      // Check if downloads path is configured
      const settings = getSettings();
      const downloadsPath = settings.downloadsPath;

      if (!downloadsPath) {
        // Show configuration dialog
        setShowPathDialog(true);
        return;
      }

      // Use the configured path
      openInVSCodeWithPath(downloadsPath);
      
    } catch (err) {
      console.error('Failed to open in VS Code:', err);
      showSnackbar('Code copied to clipboard. Create a new file in VS Code and paste (Ctrl/Cmd+V)', 'warning');
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          my: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            bgcolor: isDarkMode ? 'grey.900' : 'grey.100',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {language || 'plaintext'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Open in VS Code">
              <IconButton
                size="small"
                onClick={handleOpenInVSCode}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: isDarkMode ? 'grey.800' : 'grey.200',
                  },
                  '& img': {
                    width: 16,
                    height: 16,
                  }
                }}
              >
                <img src={VSCodeIconSvg} alt="VS Code" />
              </IconButton>
            </Tooltip>
            <Tooltip title={copied ? "Copied!" : "Copy code"}>
              <IconButton
                size="small"
                onClick={handleCopy}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: isDarkMode ? 'grey.800' : 'grey.200',
                  },
                }}
              >
                {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Code content */}
        <Box
          sx={{
            '& pre': {
              margin: 0,
              borderRadius: 0,
            },
          }}
        >
          <SyntaxHighlighter
            style={isDarkMode ? vscDarkPlus : vs}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '16px',
              backgroundColor: isDarkMode ? '#1e1e1e' : '#f6f8fa',
              fontSize: '14px',
              lineHeight: 1.5,
            }}
          >
            {children}
          </SyntaxHighlighter>
        </Box>
      </Paper>

      {/* Downloads Path Configuration Dialog */}
      <DownloadsPathDialog
        open={showPathDialog}
        onClose={handlePathDialogClose}
      />

      {/* Snackbar for notifications */}
      {snackbar && (
        <Snackbar
          open={true}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
            variant="filled"
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const theme = useTheme();

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with syntax highlighting
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <CodeBlock language={match[1]}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          ) : (
            <code
              style={{
                backgroundColor: theme.palette.mode === 'dark' 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(135, 131, 120, 0.15)',
                borderRadius: '3px',
                padding: '0.2em 0.4em',
                fontSize: '85%',
                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
              }}
            >
              {children}
            </code>
          );
        },
        // Tables with MUI styling
        table({ children }: any) {
          return (
            <TableContainer component={Paper} sx={{ my: 2 }}>
              <Table size="small">{children}</Table>
            </TableContainer>
          );
        },
        thead({ children }: any) {
          return <TableHead>{children}</TableHead>;
        },
        tbody({ children }: any) {
          return <TableBody>{children}</TableBody>;
        },
        tr({ children }: any) {
          return <TableRow>{children}</TableRow>;
        },
        td({ children }: any) {
          return <TableCell>{children}</TableCell>;
        },
        th({ children }: any) {
          return <TableCell component="th" sx={{ fontWeight: 'bold' }}>{children}</TableCell>;
        },
        // Typography elements
        p({ children }: any) {
          return <Typography component="p" sx={{ mb: 2 }}>{children}</Typography>;
        },
        h1({ children }: any) {
          return <Typography variant="h4" component="h1" sx={{ mb: 2, mt: 3 }}>{children}</Typography>;
        },
        h2({ children }: any) {
          return <Typography variant="h5" component="h2" sx={{ mb: 2, mt: 2.5 }}>{children}</Typography>;
        },
        h3({ children }: any) {
          return <Typography variant="h6" component="h3" sx={{ mb: 1.5, mt: 2 }}>{children}</Typography>;
        },
        h4({ children }: any) {
          return <Typography variant="subtitle1" component="h4" sx={{ mb: 1, mt: 1.5, fontWeight: 'bold' }}>{children}</Typography>;
        },
        h5({ children }: any) {
          return <Typography variant="subtitle2" component="h5" sx={{ mb: 0.5, mt: 1, fontWeight: 'bold' }}>{children}</Typography>;
        },
        h6({ children }: any) {
          return <Typography variant="body2" component="h6" sx={{ mb: 0.5, mt: 1, fontWeight: 'bold' }}>{children}</Typography>;
        },
        // Lists
        ul({ children }: any) {
          return <Box component="ul" sx={{ pl: 3, mb: 2 }}>{children}</Box>;
        },
        ol({ children }: any) {
          return <Box component="ol" sx={{ pl: 3, mb: 2 }}>{children}</Box>;
        },
        li({ children }: any) {
          return <Box component="li" sx={{ mb: 0.5 }}>{children}</Box>;
        },
        // Blockquotes
        blockquote({ children }: any) {
          return (
            <Box
              component="blockquote"
              sx={{
                borderLeft: '4px solid',
                borderColor: 'divider',
                pl: 2,
                ml: 0,
                my: 2,
                color: 'text.secondary',
              }}
            >
              {children}
            </Box>
          );
        },
        // Horizontal rule
        hr() {
          return <Box component="hr" sx={{ my: 3, border: 'none', borderTop: '1px solid', borderColor: 'divider' }} />;
        },
        // Links
        a({ href, children }: any) {
          return (
            <Box
              component="a"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: 'primary.main',
                textDecoration: 'underline',
                '&:hover': {
                  textDecoration: 'none',
                },
              }}
            >
              {children}
            </Box>
          );
        },
        // Strong/bold
        strong({ children }: any) {
          return <Box component="strong" sx={{ fontWeight: 'bold' }}>{children}</Box>;
        },
        // Emphasis/italic
        em({ children }: any) {
          return <Box component="em" sx={{ fontStyle: 'italic' }}>{children}</Box>;
        },
        // Strikethrough
        del({ children }: any) {
          return <Box component="del" sx={{ textDecoration: 'line-through' }}>{children}</Box>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}; 