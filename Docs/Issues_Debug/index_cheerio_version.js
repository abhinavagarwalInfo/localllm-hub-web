import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as cheerio from 'cheerio';
import { 
  userQueries, 
  sessionQueries, 
  activityQueries, 
  documentQueries, 
  chunkQueries,
  conversationQueries
} from './database.js';
import { requireAuth, requireRole, requireMinRole, logActivity } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for Vite
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts'
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}

// ============ AUTH ROUTES ============

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = userQueries.findByUsername.get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    sessionQueries.create.run(sessionId, user.id, expiresAt.toISOString());
    userQueries.updateLastLogin.run(user.id);
    
    // Log activity
    activityQueries.log.run(user.id, 'LOGIN', 'User logged in', req.ip);
    
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const sessionId = req.cookies.session_id;
  
  if (sessionId) {
    sessionQueries.deleteById.run(sessionId);
  }
  
  activityQueries.log.run(req.user.id, 'LOGOUT', 'User logged out', req.ip);
  
  res.clearCookie('session_id');
  res.json({ message: 'Logged out successfully' });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Change password
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both passwords required' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  const user = userQueries.findById.get(req.user.id);
  
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }
  
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  userQueries.updatePassword.run(hashedPassword, req.user.id);
  
  activityQueries.log.run(req.user.id, 'PASSWORD_CHANGED', 'Password changed', req.ip);
  
  res.json({ message: 'Password changed successfully' });
});

// ============ USER MANAGEMENT (ADMIN ONLY) ============

// Get all users
app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = userQueries.getAll.all();
  res.json({ users });
});

// Create user
app.post('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { username, password, email, full_name, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role required' });
    }
    
    if (!['admin', 'developer', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = userQueries.create.run(
      username,
      hashedPassword,
      email || null,
      full_name || null,
      role,
      1
    );
    
    activityQueries.log.run(
      req.user.id,
      'USER_CREATED',
      `Created user: ${username} with role: ${role}`,
      req.ip
    );
    
    res.json({ 
      message: 'User created successfully',
      userId: result.lastInsertRowid
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
app.put('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, role, is_active } = req.body;
    
    if (!['admin', 'developer', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    userQueries.update.run(
      email || null,
      full_name || null,
      role,
      is_active ? 1 : 0,
      id
    );
    
    activityQueries.log.run(
      req.user.id,
      'USER_UPDATED',
      `Updated user ID: ${id}`,
      req.ip
    );
    
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    userQueries.delete.run(id);
    
    activityQueries.log.run(
      req.user.id,
      'USER_DELETED',
      `Deleted user ID: ${id}`,
      req.ip
    );
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get activity log
app.get('/api/activity', requireAuth, requireRole('admin'), (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const activities = activityQueries.getRecent.all(limit);
  res.json({ activities });
});

// ============ DOCUMENT ROUTES (ROLE-BASED) ============

// Upload requires developer or admin
app.post('/api/upload', requireAuth, requireMinRole('developer'), logActivity('DOCUMENT_UPLOAD'), async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];
    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];

    for (const file of files) {
      const fileData = {
        name: file.name,
        type: file.name.split('.').pop().toLowerCase(),
        content: file.data.toString('base64'),
        size: file.size
      };
      uploadedFiles.push(fileData);
    }

    res.json({ files: uploadedFiles });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

// Save processed document with chunks
app.post('/api/documents/save', requireAuth, requireMinRole('developer'), async (req, res) => {
  try {
    const { name, type, size, chunks, metadata } = req.body;
    
    if (!name || !chunks || !Array.isArray(chunks)) {
      return res.status(400).json({ error: 'Invalid document data' });
    }

    // Mark as public if uploaded by admin
    const isPublic = req.user.role === 'admin' ? 1 : 0;
    
    // Save document
    const docResult = documentQueries.create.run(
      req.user.id,
      name,
      type,
      size,
      JSON.stringify(metadata || {}),
      chunks.length,
      isPublic
    );
    
    const documentId = docResult.lastInsertRowid;
    
    // Save chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      chunkQueries.create.run(
        documentId,
        i,
        chunk.text,
        JSON.stringify(chunk.embedding || []),
        JSON.stringify(chunk.metadata || {})
      );
    }
    
    activityQueries.log.run(
      req.user.id,
      'DOCUMENT_SAVED',
      `Saved document: ${name} with ${chunks.length} chunks`,
      req.ip
    );
    
    res.json({ 
      success: true, 
      documentId,
      isPublic 
    });
  } catch (error) {
    console.error('Save document error:', error);
    res.status(500).json({ error: 'Failed to save document', message: error.message });
  }
});

// Get user's documents + all public documents (admin uploads)
app.get('/api/documents', requireAuth, (req, res) => {
  try {
    const allDocs = documentQueries.findAll.all(req.user.id);
    
    // Add shared flag for public docs not owned by user
    const docsWithFlags = allDocs.map(doc => ({
      ...doc,
      metadata: doc.metadata ? JSON.parse(doc.metadata) : {},
      shared: doc.is_public === 1 && doc.user_id !== req.user.id
    }));
    
    res.json({ documents: docsWithFlags });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get document chunks
app.get('/api/documents/:id/chunks', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has access to this document
    const doc = documentQueries.findById.get(id);
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check permission: own document or public document
    if (doc.user_id !== req.user.id && doc.is_public !== 1) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const chunks = chunkQueries.findByDocumentId.all(id);
    
    const chunksWithData = chunks.map(chunk => ({
      ...chunk,
      embedding: chunk.embedding ? JSON.parse(chunk.embedding) : [],
      metadata: chunk.metadata ? JSON.parse(chunk.metadata) : {}
    }));
    
    res.json({ chunks: chunksWithData });
  } catch (error) {
    console.error('Get chunks error:', error);
    res.status(500).json({ error: 'Failed to fetch chunks' });
  }
});

// Delete document
app.delete('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = documentQueries.findById.get(id);
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Only owner or admin can delete
    if (doc.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete chunks first (cascade should handle this, but explicit is better)
    chunkQueries.deleteByDocumentId.run(id);
    
    // Delete document
    documentQueries.delete.run(id);
    
    activityQueries.log.run(
      req.user.id,
      'DOCUMENT_DELETED',
      `Deleted document: ${doc.filename}`,
      req.ip
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ==================== WEB URL FETCHING ROUTE (CHEERIO VERSION) ====================

app.post('/api/fetch-url', requireAuth, requireMinRole('developer'), async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    let validUrl;
    try {
      validUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log(`📡 Fetching URL: ${url}`);

    // Fetch the web page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LocalLLMBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Parse HTML with cheerio
      const $ = cheerio.load(html);

      // Remove scripts, styles, nav, footer, ads, comments
      $('script, style, nav, footer, aside, .ad, .advertisement, .ads, #comments, .comments').remove();

      // Try to get page title
      const title = $('title').text().trim() || 
                    $('h1').first().text().trim() || 
                    $('meta[property="og:title"]').attr('content') ||
                    validUrl.hostname;

      // Try to find main content area (in order of priority)
      let content = '';
      const mainSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content-area',
        '#main-content',
        '#content',
        '.content'
      ];

      for (const selector of mainSelectors) {
        const mainContent = $(selector).first();
        if (mainContent.length > 0) {
          content = mainContent.text();
          if (content.trim().length > 500) { // Good enough content found
            break;
          }
        }
      }

      // Fallback: get body text if no main content found
      if (!content || content.trim().length < 100) {
        content = $('body').text();
      }

      // Clean the text
      content = content
        .replace(/\s+/g, ' ')      // Multiple spaces to single
        .replace(/\n+/g, '\n')     // Multiple newlines to single
        .replace(/\t+/g, ' ')      // Tabs to spaces
        .trim();

      if (!content || content.length < 100) {
        return res.status(400).json({ 
          error: 'Could not extract meaningful content from URL. Page might be behind authentication, use JavaScript, or be mostly graphical.' 
        });
      }

      // Create formatted content with metadata
      const fullContent = `
# ${title}

**Source:** ${url}
**Fetched:** ${new Date().toISOString()}

---

${content}
      `.trim();

      console.log(`✅ Extracted ${fullContent.length} characters from ${url}`);

      // Log activity
      activityQueries.log.run(
        req.user.id,
        'URL_FETCHED',
        `Fetched URL: ${url}`,
        req.ip
      );

      res.json({
        content: fullContent,
        title: title,
        url: url,
        excerpt: content.substring(0, 200) + '...',
        length: fullContent.length
      });

    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ URL fetch error:', error);
    
    // Provide helpful error messages
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      return res.status(408).json({ 
        error: 'Request timed out. The website might be slow or unreachable.' 
      });
    }

    if (error.message.includes('HTTP 403') || error.message.includes('Forbidden')) {
      return res.status(403).json({ 
        error: 'Access denied. The website blocks automated access or requires authentication.' 
      });
    }

    if (error.message.includes('HTTP 401')) {
      return res.status(401).json({ 
        error: 'Authentication required. The page is behind a login.' 
      });
    }

    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      return res.status(404).json({ 
        error: 'Website not found. Please check the URL is correct.' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch URL',
      message: error.message 
    });
  }
});

// ==================== CONVERSATION HISTORY ROUTES ====================

// Get all conversations for current user (ALL ROLES)
app.get('/api/conversations', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = conversationQueries.getByUserId.all(userId);
    
    res.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('Error in /api/conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get single conversation with messages
app.get('/api/conversations/:id', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    const conversation = conversationQueries.getById.get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const messages = conversationQueries.getMessages.all(conversationId);
    
    res.json({
      conversation,
      messages: messages || []
    });
  } catch (error) {
    console.error('Error in /api/conversations/:id:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Create new conversation
app.post('/api/conversations', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const result = conversationQueries.create.run(userId, title);
    const conversationId = result.lastInsertRowid;
    
    activityQueries.log.run(
      userId,
      'CONVERSATION_CREATED',
      `Created conversation: ${title}`,
      req.ip
    );
    
    res.json({
      conversation: {
        id: conversationId,
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in /api/conversations POST:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Add message to conversation
app.post('/api/conversations/:id/messages', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { role, content } = req.body;
    
    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }
    
    if (!['user', 'assistant'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "user" or "assistant"' });
    }
    
    const conversation = conversationQueries.getById.get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const result = conversationQueries.addMessage.run(conversationId, role, content);
    conversationQueries.updateTimestamp.run(conversationId);
    
    res.json({
      message: {
        id: result.lastInsertRowid,
        conversation_id: conversationId,
        role,
        content,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in /api/conversations/:id/messages:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Update conversation title
app.put('/api/conversations/:id', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const result = conversationQueries.updateTitle.run(title, conversationId, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    activityQueries.log.run(
      userId,
      'CONVERSATION_UPDATED',
      `Updated conversation title to: ${title}`,
      req.ip
    );
    
    res.json({ success: true, title });
  } catch (error) {
    console.error('Error in /api/conversations/:id PUT:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// Delete conversation
app.delete('/api/conversations/:id', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    const conversation = conversationQueries.getById.get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const result = conversationQueries.delete.run(conversationId, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    activityQueries.log.run(
      userId,
      'CONVERSATION_DELETED',
      `Deleted conversation: ${conversation.title}`,
      req.ip
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/conversations/:id DELETE:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Search conversations
app.get('/api/conversations/search/:query', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const query = req.params.query;
    const searchPattern = `%${query}%`;
    
    const conversations = conversationQueries.search.all(
      userId, 
      searchPattern, 
      searchPattern
    );
    
    res.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('Error in /api/conversations/search:', error);
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// Bulk save conversation
app.post('/api/conversations/save-bulk', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { title, messages } = req.body;
    
    if (!title || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Title and messages array required' });
    }
    
    if (messages.length === 0) {
      return res.status(400).json({ error: 'Messages array cannot be empty' });
    }
    
    const result = conversationQueries.create.run(userId, title);
    const conversationId = result.lastInsertRowid;
    
    const insertMessage = conversationQueries.addMessage;
    
    let savedCount = 0;
    for (const msg of messages) {
      if (msg.role && msg.content && ['user', 'assistant'].includes(msg.role)) {
        insertMessage.run(conversationId, msg.role, msg.content);
        savedCount++;
      }
    }
    
    activityQueries.log.run(
      userId,
      'CONVERSATION_SAVED',
      `Saved conversation: ${title} with ${savedCount} messages`,
      req.ip
    );
    
    res.json({
      success: true,
      conversation: {
        id: conversationId,
        title,
        message_count: savedCount
      }
    });
  } catch (error) {
    console.error('Error in /api/conversations/save-bulk:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
});

// ============ OLLAMA PROXY ============

app.post('/api/ollama/*', requireAuth, logActivity('OLLAMA_REQUEST'), async (req, res) => {
  try {
    const ollamaPath = req.params[0];
    const url = `${OLLAMA_URL}/api/${ollamaPath}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    if (req.body.stream) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
      
      res.end();
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Ollama proxy error:', error);
    res.status(500).json({ error: 'Ollama request failed', message: error.message });
  }
});

app.get('/api/ollama/models', requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (response.ok) {
      res.json({ status: 'connected', url: OLLAMA_URL });
    } else {
      res.json({ status: 'disconnected', url: OLLAMA_URL });
    }
  } catch (error) {
    res.json({ status: 'disconnected', url: OLLAMA_URL });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 LocalLLM Hub Server Running (Multi-User) 🚀        ║
║                                                            ║
║  Server:        http://localhost:${PORT}                     ║
║  API:           http://localhost:${PORT}/api                ║
║  Ollama:        ${OLLAMA_URL}                    ║
║                                                            ║
║  Environment:   ${process.env.NODE_ENV || 'development'}                              ║
║  Auth:          ✅ ENABLED                                 ║
║  Roles:         Admin, Developer, Viewer                   ║
║  History:       ✅ ENABLED (All Users)                     ║
║  Web Fetch:     ✅ ENABLED (Cheerio)                       ║
║  Image OCR:     ✅ ENABLED (Tesseract)                     ║
║                                                            ║
║  Default Admin: admin / admin123                          ║
║  ⚠️  CHANGE DEFAULT PASSWORD IMMEDIATELY!                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
