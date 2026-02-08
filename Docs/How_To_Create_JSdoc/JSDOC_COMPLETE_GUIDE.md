# 📚 LocalLLM Hub - JSDoc Documentation Guide

Complete JavaScript documentation for all project files using JSDoc standards.

---

## 📋 Table of Contents

1. [Backend Documentation](#backend-documentation)
   - [server/index.js](#serverindexjs)
   - [server/database.js](#serverdatabasejs)
   - [server/middleware/auth.js](#servermiddlewareauthjs)
2. [Frontend Documentation](#frontend-documentation)
   - [src/App.jsx](#srcappjsx)
   - [src/components/Chat.jsx](#srccomponentschatjsx)
   - [src/components/DocumentManager.jsx](#srccomponentsdocumentmanagerjsx)
   - [src/components/ConversationHistory.jsx](#srccomponentsconversationhistoryjsx)
   - [src/components/UserManagement.jsx](#srccomponentsusermanagementjsx)
   - [src/components/Login.jsx](#srccomponentsloginjsx)
3. [Configuration Files](#configuration-files)
4. [JSDoc Setup](#jsdoc-setup)
5. [Generating Documentation](#generating-documentation)

---

## Backend Documentation

### server/index.js

```javascript
/**
 * @fileoverview Express Server - Main Application Entry Point
 * @module server/index
 * @requires express
 * @requires cors
 * @requires express-fileupload
 * @requires express-session
 * @requires cookie-parser
 * @requires helmet
 * @requires express-rate-limit
 * @requires dotenv
 * @requires bcryptjs
 * @requires crypto
 * @requires cheerio
 * @requires ./database
 * @requires ./middleware/auth
 * 
 * Main server file that handles:
 * - Express server configuration
 * - Authentication routes
 * - Document management API
 * - Conversation history API
 * - Ollama proxy for LLM inference
 * - Web URL fetching and scraping
 * - User management (admin only)
 * - Activity logging
 * 
 * @author Your Team
 * @version 2.0.0
 */

import express from 'express';
import cors from 'cors';
// ... other imports

/**
 * Express application instance
 * @type {Express}
 * @constant
 */
const app = express();

/**
 * Server port from environment or default
 * @type {number}
 * @constant
 */
const PORT = process.env.PORT || 3001;

/**
 * Ollama API URL
 * @type {string}
 * @constant
 */
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

/**
 * Authentication Routes
 * @namespace AuthRoutes
 */

/**
 * POST /api/auth/login
 * User login endpoint
 * 
 * @route POST /api/auth/login
 * @group Authentication - User authentication operations
 * @param {LoginRequest} request.body - Login credentials
 * @returns {LoginResponse} 200 - Successful login with user data
 * @returns {Error} 400 - Missing username or password
 * @returns {Error} 401 - Invalid credentials
 * @returns {Error} 500 - Server error
 * 
 * @example
 * // Request
 * POST /api/auth/login
 * {
 *   "username": "admin",
 *   "password": "admin123"
 * }
 * 
 * @example
 * // Response
 * {
 *   "user": {
 *     "id": 1,
 *     "username": "admin",
 *     "role": "admin",
 *     "email": "admin@example.com"
 *   }
 * }
 */
app.post('/api/auth/login', authLimiter, async (req, res) => {
  // Implementation...
});

/**
 * POST /api/auth/logout
 * User logout endpoint
 * 
 * @route POST /api/auth/logout
 * @group Authentication
 * @security SessionAuth
 * @returns {Object} 200 - Successfully logged out
 * 
 * @example
 * POST /api/auth/logout
 * // Returns: { "message": "Logged out successfully" }
 */
app.post('/api/auth/logout', requireAuth, (req, res) => {
  // Implementation...
});

/**
 * Document Management Routes
 * @namespace DocumentRoutes
 */

/**
 * POST /api/upload
 * Upload and process document files
 * 
 * @route POST /api/upload
 * @group Documents - Document management operations
 * @security SessionAuth
 * @consumes multipart/form-data
 * @param {File} files.files - Document files to upload
 * @returns {UploadResponse} 200 - Processed files data
 * @returns {Error} 400 - No files uploaded
 * @returns {Error} 401 - Authentication required
 * @returns {Error} 403 - Insufficient permissions (requires developer+)
 * 
 * @example
 * // Upload PDF file
 * POST /api/upload
 * Content-Type: multipart/form-data
 * files: [document.pdf]
 */
app.post('/api/upload', requireAuth, requireMinRole('developer'), async (req, res) => {
  // Implementation...
});

/**
 * POST /api/documents/save
 * Save processed document with chunks and embeddings
 * 
 * @route POST /api/documents/save
 * @group Documents
 * @security SessionAuth
 * @param {DocumentSaveRequest} request.body - Document data with chunks
 * @returns {Object} 200 - Document saved successfully
 * @returns {Error} 400 - Invalid document data
 * @returns {Error} 401 - Authentication required
 * 
 * @typedef {Object} DocumentSaveRequest
 * @property {string} name - Document filename
 * @property {string} type - Document type (pdf, docx, etc.)
 * @property {number} size - File size in bytes
 * @property {Array<ChunkData>} chunks - Document chunks with embeddings
 * @property {Object} metadata - Additional metadata
 * 
 * @typedef {Object} ChunkData
 * @property {string} text - Chunk text content
 * @property {Array<number>} embedding - Embedding vector
 * @property {Object} metadata - Chunk metadata
 */
app.post('/api/documents/save', requireAuth, requireMinRole('developer'), async (req, res) => {
  // Implementation...
});

/**
 * POST /api/fetch-url
 * Fetch and extract content from web URL
 * 
 * @route POST /api/fetch-url
 * @group Documents
 * @security SessionAuth
 * @param {URLFetchRequest} request.body - URL to fetch
 * @returns {URLFetchResponse} 200 - Extracted content
 * @returns {Error} 400 - Invalid URL or no content
 * @returns {Error} 403 - Website blocks access
 * @returns {Error} 408 - Request timeout
 * 
 * @typedef {Object} URLFetchRequest
 * @property {string} url - Web page URL
 * 
 * @typedef {Object} URLFetchResponse
 * @property {string} content - Extracted page content
 * @property {string} title - Page title
 * @property {string} url - Source URL
 * @property {string} excerpt - Content preview
 * @property {number} length - Content length
 */
app.post('/api/fetch-url', requireAuth, requireMinRole('developer'), async (req, res) => {
  // Implementation...
});

/**
 * Ollama Proxy Routes
 * @namespace OllamaRoutes
 */

/**
 * POST /api/ollama/generate
 * Generate text using Ollama LLM
 * 
 * @route POST /api/ollama/generate
 * @group Ollama - LLM operations
 * @security SessionAuth
 * @param {OllamaGenerateRequest} request.body - Generation parameters
 * @returns {Stream|Object} 200 - Generated text (stream or JSON)
 * 
 * @typedef {Object} OllamaGenerateRequest
 * @property {string} model - Model name (llama3.2, qwen2.5, etc.)
 * @property {string} prompt - Input prompt
 * @property {boolean} [stream=false] - Stream response
 * @property {string} [context] - Additional context
 * @property {Object} [options] - Model options
 */
app.post('/api/ollama/*', requireAuth, async (req, res) => {
  // Implementation...
});

/**
 * @typedef {Object} LoginRequest
 * @property {string} username - User's username
 * @property {string} password - User's password
 */

/**
 * @typedef {Object} LoginResponse
 * @property {UserObject} user - Authenticated user data
 */

/**
 * @typedef {Object} UserObject
 * @property {number} id - User ID
 * @property {string} username - Username
 * @property {string} role - User role (admin|developer|viewer)
 * @property {string|null} email - Email address
 * @property {string|null} full_name - Full name
 */

/**
 * @typedef {Object} UploadResponse
 * @property {Array<FileData>} files - Uploaded file data
 */

/**
 * @typedef {Object} FileData
 * @property {string} name - Filename
 * @property {string} type - File type
 * @property {string} content - Base64 encoded content
 * @property {number} size - File size in bytes
 */
```

### server/database.js

See [JSDOC_database.js](./JSDOC_database.js) for complete documentation.

**Key exports:**
- `userQueries` - User CRUD operations
- `sessionQueries` - Session management
- `documentQueries` - Document management
- `chunkQueries` - Chunk operations
- `conversationQueries` - Conversation history
- `activityQueries` - Activity logging

### server/middleware/auth.js

See [JSDOC_auth.js](./JSDOC_auth.js) for complete documentation.

**Key exports:**
- `requireAuth` - Authentication middleware
- `requireRole` - Exact role check
- `requireMinRole` - Minimum role check
- `logActivity` - Activity logging
- `canAccess` - Resource access check
- `canModify` - Resource modification check

---

## Frontend Documentation

### src/App.jsx

```javascript
/**
 * @fileoverview Main Application Component
 * @module src/App
 * @requires react
 * @requires ./components/Login
 * @requires ./components/Chat
 * @requires ./components/DocumentManager
 * @requires ./components/ConversationHistory
 * @requires ./components/UserManagement
 * @requires ./components/Setting
 * @requires lucide-react
 * 
 * Root application component that handles:
 * - User authentication state
 * - Route navigation between tabs
 * - Document state management
 * - Vector store for RAG
 * - User session management
 * 
 * @author Your Team
 * @version 2.0.0
 */

import { useState, useEffect } from 'react';
import Login from './components/Login';
// ... other imports

/**
 * Main Application Component
 * 
 * @component
 * @returns {React.Element} Application root component
 * 
 * @example
 * // Render application
 * <App />
 */
function App() {
  /**
   * Current authenticated user
   * @type {[Object|null, Function]}
   */
  const [user, setUser] = useState(null);

  /**
   * Currently active tab/view
   * @type {[string, Function]}
   */
  const [activeTab, setActiveTab] = useState('chat');

  /**
   * Available Ollama models
   * @type {[Array<string>, Function]}
   */
  const [models, setModels] = useState([]);

  /**
   * Currently selected model for chat
   * @type {[string, Function]}
   */
  const [selectedModel, setSelectedModel] = useState('llama3.2');

  /**
   * Uploaded documents
   * @type {[Array<DocumentObject>, Function]}
   */
  const [documents, setDocuments] = useState([]);

  /**
   * Vector store for document chunks
   * @type {[Map<string, Array>, Function]}
   */
  const [vectorStore, setVectorStore] = useState(new Map());

  /**
   * Embeddings cache
   * @type {[Map<string, Array>, Function]}
   */
  const [embeddings, setEmbeddings] = useState(new Map());

  /**
   * Chat messages
   * @type {[Array<MessageObject>, Function]}
   */
  const [messages, setMessages] = useState([]);

  /**
   * Check authentication status on mount
   * Fetches current user if session exists
   * 
   * @async
   * @function
   */
  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * Fetch available Ollama models
   * 
   * @async
   * @function
   */
  const fetchModels = async () => {
    // Implementation...
  };

  /**
   * Handle user logout
   * Clears session and resets state
   * 
   * @async
   * @function
   */
  const handleLogout = async () => {
    // Implementation...
  };

  /**
   * Start new chat conversation
   * Clears current messages and resets conversation state
   * 
   * @function
   */
  const handleNewChat = () => {
    setMessages([]);
    setConversationTitle(null);
  };

  // ... rest of component
}

/**
 * @typedef {Object} DocumentObject
 * @property {number} id - Document ID
 * @property {string} filename - File name
 * @property {string} file_type - File type
 * @property {number} file_size - File size in bytes
 * @property {number} chunks_count - Number of chunks
 * @property {boolean} shared - Whether document is shared
 * @property {string} created_at - Creation timestamp
 */

/**
 * @typedef {Object} MessageObject
 * @property {string} role - Message role (user|assistant)
 * @property {string} content - Message content
 * @property {Array<SourceObject>} [sources] - Source documents used
 */

/**
 * @typedef {Object} SourceObject
 * @property {string} doc - Document filename
 * @property {number} score - Relevance score (0-1)
 * @property {string} text - Chunk text
 */
```

### src/components/Chat.jsx

```javascript
/**
 * @fileoverview RAG Chat Component
 * @module src/components/Chat
 * @requires react
 * @requires lucide-react
 * @requires ./Chat.css
 * 
 * Provides RAG-powered chat interface with:
 * - 6-signal ranking system for context retrieval
 * - Conversation memory (last 6 messages)
 * - Response length control (brief, concise, detailed, list)
 * - Source tracking and display
 * - Real-time streaming responses
 * 
 * @author Your Team
 * @version 2.0.0
 */

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, FileText, Brain, Plus, Save } from 'lucide-react';
import './Chat.css';

/**
 * Chat Component - RAG-powered conversation interface
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array<DocumentObject>} props.documents - Available documents
 * @param {string} props.selectedModel - Selected LLM model
 * @param {Map<string, Array>} props.vectorStore - Document chunks
 * @param {Map<string, Array>} props.embeddings - Embedding cache
 * @param {Object} props.user - Current user
 * @param {Array<MessageObject>} props.messages - Chat messages
 * @param {Function} props.setMessages - Message state setter
 * @param {string} props.conversationTitle - Current conversation title
 * @param {Function} props.onNewChat - New chat handler
 * 
 * @returns {React.Element} Chat interface component
 * 
 * @example
 * <Chat
 *   documents={documents}
 *   selectedModel="llama3.2"
 *   vectorStore={vectorStore}
 *   embeddings={embeddings}
 *   user={user}
 *   messages={messages}
 *   setMessages={setMessages}
 *   onNewChat={handleNewChat}
 * />
 */
function Chat({ 
  documents, 
  selectedModel, 
  vectorStore, 
  embeddings, 
  user, 
  messages, 
  setMessages,
  conversationTitle,
  onNewChat 
}) {
  /**
   * Current input text
   * @type {[string, Function]}
   */
  const [input, setInput] = useState('');

  /**
   * Loading state during LLM generation
   * @type {[boolean, Function]}
   */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Source documents used in last response
   * @type {[Array<SourceObject>, Function]}
   */
  const [usedSources, setUsedSources] = useState([]);

  /**
   * Calculate cosine similarity between two vectors
   * 
   * @function
   * @param {Array<number>} vec1 - First vector
   * @param {Array<number>} vec2 - Second vector
   * @returns {number} Similarity score (0-1)
   * 
   * @example
   * const similarity = cosineSimilarity([0.1, 0.2, 0.3], [0.2, 0.3, 0.4]);
   * // Returns: 0.998...
   */
  const cosineSimilarity = (vec1, vec2) => {
    // Implementation...
  };

  /**
   * Generate query embedding using Ollama
   * 
   * @async
   * @function
   * @param {string} query - Query text
   * @returns {Promise<Array<number>>} Embedding vector
   * 
   * @example
   * const embedding = await generateQueryEmbedding("What is AI?");
   * // Returns: [0.123, 0.456, ...]
   */
  const generateQueryEmbedding = async (query) => {
    // Implementation...
  };

  /**
   * Detect desired response length from query
   * 
   * @function
   * @param {string} query - User query
   * @returns {string} Response type (brief|concise|list|detailed|balanced)
   * 
   * @example
   * detectResponseLength("Briefly, what is AI?");
   * // Returns: "brief"
   * 
   * @example
   * detectResponseLength("List the main features");
   * // Returns: "list"
   */
  const detectResponseLength = (query) => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.match(/\b(in one line|one sentence|briefly)\b/)) {
      return 'brief';
    }
    if (lowerQuery.match(/\b(list|enumerate)\b/)) {
      return 'list';
    }
    if (lowerQuery.match(/\b(in detail|comprehensive|thorough)\b/)) {
      return 'detailed';
    }
    
    return 'balanced';
  };

  /**
   * Perform RAG retrieval with 6-signal ranking
   * 
   * @async
   * @function
   * @param {string} query - User query
   * @returns {Promise<Array<RetrievedChunk>>} Ranked chunks
   * 
   * @typedef {Object} RetrievedChunk
   * @property {string} text - Chunk text
   * @property {string} doc - Source document
   * @property {number} score - Combined relevance score
   * @property {number} semanticScore - Semantic similarity score
   * @property {number} keywordScore - Keyword matching score
   * @property {number} exactPhraseScore - Exact phrase score
   * @property {number} proximityScore - Word proximity score
   * @property {number} qaScore - Q&A alignment score
   * @property {number} qualityScore - Chunk quality score
   */
  const retrieveRelevantChunks = async (query) => {
    // 6-signal ranking implementation...
  };

  /**
   * Send message and get LLM response
   * 
   * @async
   * @function
   */
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // RAG retrieval
      const relevantChunks = await retrieveRelevantChunks(input);
      
      // Build context
      const context = relevantChunks
        .map(chunk => `[${chunk.doc}]: ${chunk.text}`)
        .join('\n\n');

      // Generate response
      // Implementation...
      
    } catch (error) {
      console.error('Chat error:', error);
      // Error handling...
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save current conversation
   * 
   * @async
   * @function
   */
  const handleSaveConversation = async () => {
    // Implementation...
  };

  // ... rest of component
}

export default Chat;
```

### src/components/DocumentManager.jsx

```javascript
/**
 * @fileoverview Document Upload and Management Component
 * @module src/components/DocumentManager
 * @requires react
 * @requires lucide-react
 * @requires pdfjs-dist
 * @requires mammoth
 * @requires xlsx
 * @requires tesseract.js
 * @requires ./DocumentManager.css
 * 
 * Handles document processing for multiple formats:
 * - PDF (pdfjs-dist)
 * - DOCX (mammoth)
 * - XLSX/XLS (xlsx)
 * - CSV (native)
 * - Text files (txt, md)
 * - Images with OCR (tesseract.js)
 * - Figma exports (OCR)
 * - Web URLs (cheerio/readability)
 * 
 * @author Your Team
 * @version 2.0.0
 */

/**
 * Document Manager Component
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Array<DocumentObject>} props.documents - Current documents
 * @param {Function} props.setDocuments - Documents state setter
 * @param {Map} props.vectorStore - Vector store
 * @param {Function} props.setVectorStore - Vector store setter
 * @param {Map} props.embeddings - Embeddings cache
 * @param {Function} props.setEmbeddings - Embeddings setter
 * @param {Object} props.user - Current user
 * 
 * @returns {React.Element} Document management interface
 * 
 * @example
 * <DocumentManager
 *   documents={documents}
 *   setDocuments={setDocuments}
 *   vectorStore={vectorStore}
 *   setVectorStore={setVectorStore}
 *   embeddings={embeddings}
 *   setEmbeddings={setEmbeddings}
 *   user={user}
 * />
 */
function DocumentManager({
  documents,
  setDocuments,
  vectorStore,
  setVectorStore,
  embeddings,
  setEmbeddings,
  user
}) {
  /**
   * Process uploaded file based on type
   * 
   * @async
   * @function
   * @param {File} file - File to process
   * @throws {Error} If file type not supported
   * 
   * @example
   * await processFile(uploadedFile);
   */
  const processFile = async (file) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType.startsWith('image/')) {
      await processImage(file);
    } else if (fileType === 'application/pdf') {
      await processPDF(file);
    } else if (fileName.endsWith('.docx')) {
      await processDocx(file);
    }
    // ... other types
  };

  /**
   * Process image file with OCR
   * 
   * @async
   * @function
   * @param {File} file - Image file
   * @returns {Promise<void>}
   * 
   * @example
   * await processImage(imageFile);
   * // Extracts text via Tesseract OCR
   */
  const processImage = async (file) => {
    const { data: { text } } = await Tesseract.recognize(file, 'eng');
    await processTextContent(text, file.name, 'image-ocr', {
      type: 'image',
      isFigma: file.name.includes('figma')
    });
  };

  /**
   * Create smart text chunks with overlap
   * 
   * @function
   * @param {string} text - Full text to chunk
   * @param {number} [chunkSize=500] - Maximum chunk size
   * @param {number} [overlap=50] - Overlap between chunks
   * @returns {Array<string>} Array of text chunks
   * 
   * @example
   * const chunks = createSmartChunks(longText, 500, 50);
   * // Returns: ["chunk1...", "...chunk2..."]
   */
  const createSmartChunks = (text, chunkSize = 500, overlap = 50) => {
    // Implementation...
  };

  /**
   * Generate embedding for text chunk
   * 
   * @async
   * @function
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   * 
   * @example
   * const embedding = await generateEmbedding("Sample text");
   * // Returns: [0.123, 0.456, 0.789, ...]
   */
  const generateEmbedding = async (text) => {
    const response = await fetch('/api/ollama/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text.substring(0, 2000)
      })
    });

    const data = await response.json();
    return data.embedding;
  };

  // ... rest of component
}

export default DocumentManager;
```

---

## Configuration Files

### package.json

```javascript
/**
 * @fileoverview NPM Package Configuration
 * 
 * Dependencies:
 * - express: Web framework
 * - better-sqlite3: Database
 * - react: UI framework
 * - vite: Build tool
 * - pdfjs-dist: PDF processing
 * - mammoth: DOCX processing
 * - xlsx: Excel processing
 * - tesseract.js: OCR
 * - jsdom: Web scraping
 * - bcryptjs: Password hashing
 * 
 * Scripts:
 * - dev: Start development server
 * - server: Start backend only
 * - client: Start frontend only
 * - build: Build for production
 * - preview: Preview production build
 */
```

### vite.config.js

```javascript
/**
 * @fileoverview Vite Configuration
 * @module vite.config
 * @requires vite
 * @requires @vitejs/plugin-react
 * 
 * Vite configuration for:
 * - React plugin
 * - Server proxy to backend
 * - Build optimization
 * - Development server settings
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration object
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
```

---

## JSDoc Setup

### 1. Install JSDoc

```bash
npm install --save-dev jsdoc
```

### 2. Create jsdoc.json Configuration

```json
{
  "source": {
    "include": ["server", "src"],
    "includePattern": ".+\\.jsx?$",
    "excludePattern": "(node_modules/|docs)"
  },
  "opts": {
    "destination": "./docs/jsdoc",
    "recurse": true,
    "readme": "./README.md",
    "template": "templates/default",
    "encoding": "utf8"
  },
  "plugins": ["plugins/markdown"],
  "templates": {
    "cleverLinks": true,
    "monospaceLinks": true,
    "default": {
      "outputSourceFiles": true
    }
  }
}
```

### 3. Add to package.json

```json
{
  "scripts": {
    "docs": "jsdoc -c jsdoc.json",
    "docs:serve": "npx http-server ./docs/jsdoc -p 8080"
  }
}
```

---

## Generating Documentation

### Generate HTML Documentation

```bash
# Generate JSDoc HTML
npm run docs

# Serve documentation
npm run docs:serve

# Open in browser
# http://localhost:8080
```

### Generate Markdown Documentation

```bash
# Install jsdoc-to-markdown
npm install --save-dev jsdoc-to-markdown

# Generate markdown
jsdoc2md "server/**/*.js" > docs/SERVER_API.md
jsdoc2md "src/**/*.jsx" > docs/FRONTEND_API.md
```

### Output Structure

```
docs/
├── jsdoc/               # HTML documentation
│   ├── index.html
│   ├── server_index.js.html
│   ├── server_database.js.html
│   ├── src_App.jsx.html
│   └── ...
├── SERVER_API.md        # Markdown docs for backend
└── FRONTEND_API.md      # Markdown docs for frontend
```

---

## Documentation Standards

### File Header Template

```javascript
/**
 * @fileoverview Brief description of file purpose
 * @module path/to/module
 * @requires dependency1
 * @requires dependency2
 * 
 * Detailed description of what this file does,
 * its main responsibilities, and how it fits
 * into the larger application.
 * 
 * @author Your Team
 * @version 2.0.0
 * @since 1.0.0
 * @see Related modules or documentation
 */
```

### Function Documentation Template

```javascript
/**
 * Brief description of function
 * 
 * Detailed explanation of what the function does,
 * its algorithm, and any important notes.
 * 
 * @async
 * @function functionName
 * @param {Type} paramName - Parameter description
 * @param {Type} [optionalParam=default] - Optional parameter
 * @returns {ReturnType} Description of return value
 * @throws {ErrorType} Description of error conditions
 * 
 * @example
 * // Usage example
 * const result = await functionName(param1, param2);
 * 
 * @example
 * // Another example
 * functionName('value');
 * // Returns: expected output
 */
async function functionName(paramName, optionalParam = default) {
  // Implementation
}
```

### Component Documentation Template

```javascript
/**
 * Component description
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Type} props.propName - Prop description
 * @returns {React.Element} Component element
 * 
 * @example
 * <ComponentName
 *   prop1="value"
 *   prop2={variable}
 * />
 */
```

### Type Definition Template

```javascript
/**
 * @typedef {Object} TypeName
 * @property {Type} propertyName - Property description
 * @property {Type} [optionalProperty] - Optional property
 * 
 * @example
 * const example: TypeName = {
 *   propertyName: 'value',
 *   optionalProperty: 123
 * };
 */
```

---

## Best Practices

1. **Document all public APIs** - Functions, classes, components
2. **Use meaningful examples** - Show real usage patterns
3. **Keep descriptions concise** - Brief but complete
4. **Document parameters thoroughly** - Include types and descriptions
5. **Note async functions** - Use @async tag
6. **Document errors** - Use @throws for error conditions
7. **Link related items** - Use @see for related docs
8. **Update on changes** - Keep docs in sync with code
9. **Use TypeScript types** - Even in JSDoc for better IDE support
10. **Include since/deprecated** - Track API evolution

---

## IDE Integration

### VS Code

JSDoc provides IntelliSense support in VS Code:
- Hover tooltips show documentation
- Auto-complete suggests parameters
- Type checking in JavaScript files
- Parameter hints during function calls

Enable in VS Code settings:
```json
{
  "javascript.suggest.jsdoc": true,
  "typescript.suggest.jsdoc": true
}
```

### WebStorm

JSDoc is natively supported:
- Quick documentation popup (Ctrl+Q)
- Parameter info (Ctrl+P)
- Type checking
- Code completion

---

## Additional Resources

- [JSDoc Official Documentation](https://jsdoc.app/)
- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html#jsdoc)

---

**Your project now has comprehensive JSDoc documentation!** 📚✨
