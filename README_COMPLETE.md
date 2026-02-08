# 🚀 LocalLLM Hub - RAG Application

A powerful, multi-user Retrieval-Augmented Generation (RAG) application with document processing, conversation history, and role-based access control. Built with React, Express, SQLite, and Ollama.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [RAG System](#-rag-system)
- [Authentication & Authorization](#-authentication--authorization)
- [Document Processing](#-document-processing)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Capabilities
- 🤖 **RAG-Powered Chat** - Context-aware conversations using document knowledge
- 📄 **Multi-Format Document Support** - PDF, DOCX, XLSX, CSV, TXT, MD, Images (OCR), Figma exports, Web URLs
- 🧠 **Smart Context Retrieval** - 6-signal ranking system for optimal context matching
- 💬 **Conversation Memory** - Maintains context across messages
- 📚 **Conversation History** - Save, search, and restore past conversations
- 🔐 **Multi-User Support** - Role-based access control (Admin, Developer, Viewer)
- 🌐 **Web Scraping** - Fetch and analyze content from any public URL
- 🖼️ **Image OCR** - Extract text from images and design files
- 🎯 **Response Control** - "Brief", "concise", "detailed", or "list" format options

### Advanced Features
- **Document Sharing** - Admins can share documents with all users
- **Smart Chunking** - Intelligent text segmentation with overlap
- **Vector Embeddings** - nomic-embed-text for semantic search
- **Real-Time Processing** - Live progress updates during document processing
- **Responsive UI** - Modern, dark-themed interface
- **Activity Logging** - Complete audit trail of user actions

---

## 🛠 Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **Modern CSS** - Custom styling with dark theme

### Backend
- **Node.js 18+** - Runtime environment
- **Express.js** - Web framework
- **Better-SQLite3** - Database
- **bcryptjs** - Password hashing
- **Express-Session** - Session management

### AI & Processing
- **Ollama** - LLM inference (llama3.2, qwen2.5, etc.)
- **nomic-embed-text** - Embedding model
- **PDF.js** - PDF processing
- **Mammoth** - DOCX processing
- **XLSX** - Excel processing
- **Tesseract.js** - OCR for images
- **Cheerio/JSDOM** - Web scraping
- **Mozilla Readability** - Content extraction

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React)                       │
│  ┌─────────┬──────────────┬────────────┬─────────────┐ │
│  │  Chat   │  Documents   │  History   │   Users     │ │
│  └─────────┴──────────────┴────────────┴─────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────┴────────────────────────────────┐
│                Express.js Server                        │
│  ┌──────────┬───────────┬──────────┬─────────────────┐ │
│  │   Auth   │    API    │  Ollama  │   File Upload   │ │
│  └──────────┴───────────┴──────────┴─────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼──────┐
   │ SQLite  │    │  Ollama   │   │ File System│
   │   DB    │    │  (LLM)    │   │  (Temp)    │
   └─────────┘    └───────────┘   └────────────┘
```

### Data Flow
1. **User uploads document** → File processed → Text extracted → Chunked
2. **Chunks embedded** → Vector embeddings generated via Ollama
3. **Stored in DB** → Text + embeddings + metadata saved
4. **User asks question** → Query embedded → Similarity search
5. **Context retrieved** → Top chunks selected → Sent to LLM
6. **Response generated** → LLM uses context → Returns answer

---

## 📦 Prerequisites

### Required
- **Node.js** 18 or higher
- **npm** 8 or higher
- **Ollama** installed and running
- **Git** for version control

### Ollama Models
```bash
# Install required models
ollama pull llama3.2
ollama pull nomic-embed-text

# Optional models
ollama pull qwen2.5
ollama pull mistral
```

### System Requirements
- **RAM:** 16GB minimum (32GB recommended for larger models)
- **Storage:** 10GB+ free space
- **OS:** macOS, Linux, or Windows (WSL2)

---

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/localllm-hub.git
cd localllm-hub
```

### 2. Install System Dependencies

#### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Ollama
brew install ollama

# Install Node.js (if not installed)
brew install node

# Start Ollama service
brew services start ollama
```

#### Linux (Ubuntu/Debian)
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Ollama
curl https://ollama.ai/install.sh | sh

# Start Ollama
sudo systemctl start ollama
sudo systemctl enable ollama
```

#### Windows (WSL2)
```bash
# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install Ollama
curl https://ollama.ai/install.sh | sh
```

### 3. Install Ollama Models
```bash
# Required models
ollama pull llama3.2          # Primary chat model (3B - fast)
ollama pull nomic-embed-text  # Embedding model (required for RAG)

# Optional models (choose based on your needs)
ollama pull llama3.2:70b      # Larger, more capable (requires 32GB+ RAM)
ollama pull qwen2.5           # Alternative chat model
ollama pull mistral           # Another alternative
ollama pull codellama         # For code-related queries

# Verify models are installed
ollama list
```

### 4. Install Node.js Dependencies
```bash
# Install all required packages
npm install

# This installs:
# - Express & middleware (cors, helmet, session, etc.)
# - Database: better-sqlite3
# - Document processing: pdfjs-dist, mammoth, xlsx
# - OCR: tesseract.js
# - Web scraping: jsdom, @mozilla/readability
# - Security: bcryptjs
# - And all other dependencies
```

### 5. Install Additional Tools for Document Processing

#### OCR Dependencies (for image processing)
```bash
# Already included via tesseract.js (pure JavaScript)
# No additional system installation needed!

# Verify installation
npm list tesseract.js
```

#### Web Scraping Dependencies
```bash
# Install web scraping libraries
npm install jsdom @mozilla/readability cheerio

# Verify installation
npm list jsdom @mozilla/readability cheerio
```

#### PDF Processing
```bash
# Already included via pdfjs-dist
# Verify installation
npm list pdfjs-dist
```

#### Office Document Processing
```bash
# Already included in package.json
# DOCX: mammoth
# XLSX: xlsx
# Verify installation
npm list mammoth xlsx
```

### 6. Database Setup

The SQLite database is automatically created on first run with the following structure:

```bash
# Database file will be created at:
# ./chat-data.db

# Initial schema includes:
# - users (with 3 default users)
# - sessions
# - documents
# - chunks
# - conversations
# - messages
# - activity_logs

# Default users created automatically:
# Admin:     admin / admin123
# Developer: developer / dev123  
# Viewer:    viewer / view123
```

**Manual database initialization (optional):**
```bash
# If you need to reset the database
rm localllm.db
npm run server  # Database will be recreated
cd server && node migrate-documents.js
```

### 7. Configure Environment
```bash
# Create .env file from template
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Required .env variables:**
```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Ollama Configuration
OLLAMA_URL=http://localhost:11434

# Session Security (CHANGE THIS!)
SESSION_SECRET=your-super-secure-random-string-here-change-this

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Database Path (optional, defaults to ./chat-data.db)
DATABASE_PATH=./chat-data.db
```

### 8. Verify Installation

Check that all components are properly installed:

```bash
# 1. Check Node.js version
node --version  # Should be 18+

# 2. Check npm version
npm --version   # Should be 8+

# 3. Check Ollama is running
curl http://localhost:11434/api/tags

# 4. Verify required npm packages
npm list better-sqlite3    # Database
npm list tesseract.js      # OCR
npm list jsdom             # Web scraping
npm list pdfjs-dist        # PDF processing
npm list mammoth           # DOCX processing
npm list xlsx              # Excel processing

# 5. Check if database can be created
npm run server
# Press Ctrl+C after seeing "Server Running" message
# Check that chat-data.db file was created
ls -la chat-data.db
```

### 9. Start Development Server
```bash
# Start both frontend and backend
npm run dev

# Or start separately:
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

The application will be available at:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Ollama API:** http://localhost:11434

### 10. Initial Setup & Testing

#### First Login
1. Open browser to http://localhost:5173
2. Login with: `admin` / `admin123`
3. **IMPORTANT:** Change password immediately!
   - Click profile icon → Change Password

#### Test Document Upload
1. Go to Documents tab
2. Upload a test PDF or text file
3. Wait for processing (progress shown)
4. Verify document appears in list

#### Test OCR (Image Processing)
1. Take a screenshot with text
2. Upload to Documents
3. Wait for OCR processing (~5-10 seconds)
4. Verify text was extracted

#### Test Web Scraping
1. Go to Documents tab
2. Enter URL: `https://en.wikipedia.org/wiki/Artificial_intelligence`
3. Click "Fetch & Process"
4. Verify content was extracted

#### Test RAG Chat
1. Go to Chat tab
2. Select model (llama3.2)
3. Ask: "What are the main topics in my documents?"
4. Verify response uses document context

### 11. Troubleshooting Installation

#### Ollama Not Running
```bash
# Check status
curl http://localhost:11434/api/tags

# If not running:
# macOS
brew services restart ollama

# Linux
sudo systemctl restart ollama

# Check logs
ollama logs
```

#### Database Creation Failed
```bash
# Check permissions
ls -la ./

# Create directory if needed
mkdir -p data

# Try with specific path
DATABASE_PATH=./data/chat-data.db npm run server
```

#### OCR Installation Issues
```bash
# Reinstall tesseract.js
npm uninstall tesseract.js
npm install tesseract.js

# Clear npm cache
npm cache clean --force
npm install
```

#### Web Scraping Issues
```bash
# If jsdom has version conflicts
npm uninstall jsdom @mozilla/readability
npm install jsdom@22.1.0 @mozilla/readability

# Or use cheerio alternative
npm install cheerio
```

#### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in .env
echo "PORT=3002" >> .env
```

### 12. Post-Installation Checklist

After installation, verify:

- [ ] Node.js 18+ installed
- [ ] Ollama running and models pulled
- [ ] `npm install` completed without errors
- [ ] `.env` file configured
- [ ] Database file created (`chat-data.db`)
- [ ] Server starts without errors (`npm run dev`)
- [ ] Frontend loads at http://localhost:5173
- [ ] Can login with default credentials
- [ ] Can upload a document
- [ ] OCR works with images
- [ ] Web URL fetching works
- [ ] Chat responds with context from documents

**Congratulations! Your LocalLLM Hub is now installed and ready to use! 🎉**

---

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Ollama Configuration
OLLAMA_URL=http://localhost:11434

# Session Configuration
SESSION_SECRET=your-secure-random-string-here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Database (auto-created)
DATABASE_PATH=./chat-data.db
```

### Default Credentials

**Important:** Change these immediately after first login!

```
Admin User:
Username: admin
Password: admin123

Developer User:
Username: developer
Password: dev123

Viewer User:
Username: viewer
Password: view123
```

---

## 🎯 Usage

### 1. Login
Navigate to http://localhost:5173 and login with default credentials.

### 2. Upload Documents
- Go to **Documents** tab
- Click "Upload" or drag & drop files
- Supported formats: PDF, DOCX, XLSX, CSV, TXT, MD, JPG, PNG, GIF

### 3. Fetch Web Content
- Enter any public URL
- Click "Fetch & Process"
- Content extracted and indexed automatically

### 4. Start Chatting
- Go to **Chat** tab
- Select a model (llama3.2, qwen2.5, etc.)
- Ask questions about your documents
- Specify format: "briefly", "in detail", "list", etc.

### 5. Save Conversations
- Click "Save" button during chat
- Enter a title
- Access from **History** tab

### 6. Manage Users (Admin Only)
- Go to **Users** tab
- Create, edit, or delete users
- Assign roles: Admin, Developer, Viewer

---

## 📁 Project Structure

```
localllm-hub/
├── server/                             # Backend
│   ├── index.js                        # Express server & routes
│   ├── database.js                     # SQLite database & queries
│   ├── database_conversations.js            
│   └── middleware/
│       └── auth.js                     # Authentication middleware
│
├── src/                                # Frontend
│   ├── App.jsx                         # Main application component
│   ├── App.css                         # Global styles
│   ├── components/
│   │   ├── Login.jsx                   # Login component
│   │   ├── Login.css                   # Login styling
│   │   ├── Chat.jsx                    # RAG chat interface
│   │   ├── Chat.css                    # Chat styling
│   │   ├── Setting.jsx                 # Setting component
│   │   ├── Setting.css                 # Setting styling
│   │   ├── DocumentManager.jsx         # Document upload/management
│   │   ├── DocumentManager.css         # Document styling
│   │   ├── ConversationHistory.jsx     # History interface
│   │   ├── ConversationHistory.css     # History styling
│   │   ├── UserManagement.jsx          # User admin (admin only)
│   │   └── UserManagement.css          # User admin styling
│   └── main.jsx                        # React entry point
│
├── public/                             # Static assets
├── .env                                # Environment variables
├── .env.example                        # Environment template
├── package.json                        # Dependencies
├── vite.config.js                      # Vite configuration
├── index.html
├── data              
│   ├── localllm.db                     # SQLite database (auto-created)   
│           
└── README.md                           # This file
```

---

## 📡 API Documentation

### Authentication

#### POST /api/auth/login
Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "email": "admin@example.com"
  }
}
```

#### POST /api/auth/logout
Logout current user (requires authentication).

#### GET /api/auth/me
Get current user information (requires authentication).

### Documents

#### GET /api/documents
Get all documents accessible to current user.
- **Own documents** (created by user)
- **Shared documents** (created by admin with is_public=1)

#### POST /api/documents/save
Save processed document with chunks and embeddings.

**Request:**
```json
{
  "name": "project_plan.pdf",
  "type": "pdf",
  "size": 1234567,
  "chunks": [
    {
      "text": "Chunk content...",
      "embedding": [0.123, 0.456, ...],
      "metadata": {
        "chunkIndex": 0,
        "source": "project_plan.pdf"
      }
    }
  ],
  "metadata": {
    "pages": 10
  }
}
```

#### DELETE /api/documents/:id
Delete a document (owner or admin only).

#### GET /api/documents/:id/chunks
Get all chunks for a specific document.

#### POST /api/fetch-url
Fetch and process web page content.

**Request:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "content": "Extracted article text...",
  "title": "Article Title",
  "url": "https://example.com/article",
  "excerpt": "Preview...",
  "length": 5000
}
```

### Conversations

#### GET /api/conversations
Get all conversations for current user.

#### GET /api/conversations/:id
Get specific conversation with messages.

#### POST /api/conversations
Create new conversation.

**Request:**
```json
{
  "title": "Discussion about project requirements"
}
```

#### POST /api/conversations/:id/messages
Add message to conversation.

**Request:**
```json
{
  "role": "user",
  "content": "What are the main requirements?"
}
```

#### PUT /api/conversations/:id
Update conversation title.

#### DELETE /api/conversations/:id
Delete conversation.

#### POST /api/conversations/save-bulk
Save entire conversation at once.

**Request:**
```json
{
  "title": "Project Discussion",
  "messages": [
    {"role": "user", "content": "Question..."},
    {"role": "assistant", "content": "Answer..."}
  ]
}
```

### Ollama Proxy

#### POST /api/ollama/generate
Generate response using Ollama.

**Request:**
```json
{
  "model": "llama3.2",
  "prompt": "Your question here",
  "stream": false,
  "context": "Additional context..."
}
```

#### POST /api/ollama/embeddings
Generate embeddings for text.

**Request:**
```json
{
  "model": "nomic-embed-text",
  "prompt": "Text to embed"
}
```

#### GET /api/ollama/models
List available Ollama models.

#### GET /api/ollama/status
Check Ollama connection status.

---

## 🧠 RAG System

### Architecture

The RAG system uses a sophisticated 6-signal ranking approach for optimal context retrieval:

#### 1. Semantic Similarity (40%)
Vector similarity using cosine distance between query and chunk embeddings.

#### 2. Keyword Matching (20%)
Term frequency weighting for exact keyword matches.

#### 3. Exact Phrase Matching (20%)
Bonus score for exact phrase occurrences.

#### 4. Word Proximity (10%)
Measures how close query words appear together in the chunk.

#### 5. Q&A Alignment (5%)
Detects question patterns and prioritizes question-like content.

#### 6. Chunk Quality (5%)
Preference for complete sentences and well-formed text.

### Context Window Management

- **Default:** 8 chunks (3-5 for brief queries)
- **Window Size:** 8192 tokens (4096 for system prompt + context)
- **Conversation History:** Last 6 messages (3 Q&A pairs)
- **Chunk Size:** 500 characters with 50-character overlap

### Response Length Control

Users can control response length:
- **"in one line"** → 1 sentence (100 tokens)
- **"briefly"** → 2-3 sentences (300 tokens)
- **"list"** → Bullet points (variable)
- **"in detail"** → Comprehensive (2048 tokens)
- **Default** → Balanced (2048 tokens)

---

## 🔐 Authentication & Authorization

### Roles

| Role | Permissions |
|------|------------|
| **Admin** | • Full system access<br>• Create/edit/delete users<br>• Upload & share documents<br>• View all activity logs<br>• Access all features |
| **Developer** | • Upload documents (private)<br>• Full chat access<br>• Save conversations<br>• Fetch web URLs<br>• Access shared documents |
| **Viewer** | • Read-only document access<br>• Chat with shared documents<br>• View conversation history<br>• Cannot upload or create |

### Session Management

- **Session Duration:** 24 hours
- **Storage:** HTTP-only cookies
- **Security:** bcrypt password hashing (10 rounds)
- **Activity Logging:** All actions logged with timestamps

### Security Features

- ✅ Password hashing with bcrypt
- ✅ HTTP-only session cookies
- ✅ CSRF protection via same-site cookies
- ✅ Rate limiting on login (5 attempts per 15 min)
- ✅ SQL injection prevention (prepared statements)
- ✅ XSS protection (Helmet middleware)
- ✅ Role-based access control
- ✅ Complete activity audit trail

---

## 📄 Document Processing

### Supported Formats

| Format | Extension | Processing Method | Features |
|--------|-----------|-------------------|----------|
| **PDF** | .pdf | PDF.js | Text extraction, page-by-page |
| **Word** | .docx | Mammoth | Full text, formatting preserved |
| **Excel** | .xlsx, .xls | XLSX | All sheets, formulas |
| **CSV** | .csv | Native | Tabular data |
| **Text** | .txt, .md | Native | Plain text |
| **Images** | .jpg, .png, .gif | Tesseract OCR | Text extraction (85-95% accuracy) |
| **Figma** | .fig, .png | Tesseract OCR | Design text extraction |
| **Web** | URL | Cheerio/Readability | Main content extraction |

### Processing Pipeline

```
1. Upload/Fetch
   ↓
2. Format Detection
   ↓
3. Text Extraction
   ↓
4. Smart Chunking (500 chars, 50 overlap)
   ↓
5. Embedding Generation (nomic-embed-text)
   ↓
6. Database Storage (text + vectors + metadata)
   ↓
7. Ready for RAG
```

### Document Sharing

**Admin documents are automatically shared:**
- Visible to all users (Admins, Developers, Viewers)
- Marked with "Shared" badge
- Read-only for non-owners

**Developer documents are private:**
- Only visible to the owner
- Can be used in their own chats
- Not visible to other users

---

## 🚀 Deployment

### Production Build

```bash
# 1. Build frontend
npm run build

# 2. Set environment
export NODE_ENV=production
export SESSION_SECRET="your-production-secret-here"

# 3. Start server
npm run server
```

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server/index.js --name "localllm-hub"

# Start on boot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs localllm-hub
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "server/index.js"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  localllm-hub:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - OLLAMA_URL=http://ollama:11434
    volumes:
      - ./chat-data.db:/app/chat-data.db
    depends_on:
      - ollama

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama

volumes:
  ollama-data:
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 🐛 Troubleshooting

### Common Issues

#### Ollama Connection Failed
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Pull required models
ollama pull llama3.2
ollama pull nomic-embed-text
```

#### Database Locked
```bash
# Stop all instances
pm2 stop all

# Remove lock
rm chat-data.db-shm chat-data.db-wal

# Restart
npm run dev
```

#### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in .env
PORT=3002
```

#### Blank Document Page
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Hard refresh browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

#### OCR Not Working
```bash
# Ensure tesseract.js is installed
npm install tesseract.js

# Check image has text
# OCR works best with:
# - High resolution images
# - Clear, readable text
# - Good contrast
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=*

# Run with verbose output
npm run dev
```

### Check Logs

```bash
# PM2 logs
pm2 logs localllm-hub

# Application logs
tail -f server.log

# Ollama logs
ollama logs
```

---

## 🎨 Customization

### Branding

Edit `src/App.jsx`:
```javascript
const APP_NAME = "Your App Name";
const APP_LOGO = "/path/to/logo.png";
```

### Theme Colors

Edit `src/App.css`:
```css
:root {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --accent-primary: #60a5fa;
  --accent-secondary: #10b981;
  --text-primary: #e0e0e0;
  --text-secondary: #888;
}
```

### Default Models

Edit `src/components/Chat.jsx`:
```javascript
const DEFAULT_MODELS = [
  'llama3.2',
  'qwen2.5',
  'mistral',
  'your-custom-model'
];
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
   ```bash
   npm run test
   npm run lint
   ```
5. **Commit with clear messages**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Code Style

- Use ES6+ features
- Follow existing code style
- Add comments for complex logic
- Update documentation
- Write meaningful commit messages

### Testing

```bash
# Run tests
npm test

# Run linter
npm run lint

# Run type checking
npm run type-check
```

---

## 📊 Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Document Upload (PDF, 10 pages) | ~3s | Including embedding |
| Image OCR | ~5-10s | Depends on resolution |
| Web URL Fetch | ~2-5s | Depends on page size |
| Query Processing | ~1-2s | Includes retrieval + LLM |
| Embedding Generation | ~500ms | Per chunk |

### Optimization Tips

1. **Use smaller models for faster responses**
   - llama3.2 (3B) is faster than llama3.2:70b
   - qwen2.5:7b good balance

2. **Reduce context window for speed**
   - Fewer chunks = faster processing
   - Use "briefly" for quick answers

3. **Batch document processing**
   - Process multiple docs at once
   - Use async operations

4. **Database maintenance**
   ```bash
   # Vacuum database periodically
   sqlite3 chat-data.db "VACUUM;"
   ```

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) - Local LLM inference
- [React](https://reactjs.org) - UI framework
- [Express](https://expressjs.com) - Backend framework
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) - Database
- [Tesseract.js](https://tesseract.projectnaptha.com) - OCR engine
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF processing

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/localllm-hub/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/localllm-hub/discussions)
- **Email:** support@yourdomain.com

---

## 🗺️ Roadmap

### Planned Features

- [ ] Multi-language support
- [ ] Plugin system for custom processors
- [ ] Advanced analytics dashboard
- [ ] Real-time collaboration
- [ ] Mobile app (React Native)
- [ ] Cloud deployment templates
- [ ] Advanced search filters
- [ ] Document versioning
- [ ] API key management
- [ ] Webhook integrations

---

## 📚 Additional Resources

### Documentation
- [RAG Implementation Guide](docs/RAG_GUIDE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Best Practices](docs/SECURITY.md)

### Tutorials
- [Getting Started Video](https://youtube.com/...)
- [Advanced RAG Techniques](https://blog.yourdomain.com/...)
- [Custom Model Integration](https://docs.yourdomain.com/...)

---

<div align="center">

**Built with ❤️ by Your Team**

[Website](https://yourdomain.com) • [Documentation](https://docs.yourdomain.com) • [Blog](https://blog.yourdomain.com)

</div>
