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
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { 
  userQueries, 
  sessionQueries, 
  activityQueries, 
  documentQueries, 
  chunkQueries,
  conversationQueries
} from './database.js';
import db from './database.js';
import { requireAuth, requireRole, requireMinRole, logActivity } from './middleware/auth.js';
import { processDocumentAdvanced } from './document-processor-advanced.js';
import { searchRelevantChunksAdvanced, buildOptimizedContext, buildEnhancedSystemPrompt, analyzeQuery } from './rag-engine-advanced.js';
import { extractNumericData, analyzeTimeSeries } from './analytics-engine.js';
import { isAnalyticsQuery, processAnalyticsQuery } from './analytics-query-engine.js';
import { processDataQuery } from './data-query-engine.js';
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
    : (origin, callback) => {
        // In development: allow localhost:5173 AND any network-IP:5173
        // so the app works when accessed from other machines on the LAN.
        if (!origin) return callback(null, true);
        try {
          const url = new URL(origin);
          if (url.port === '5173') return callback(null, true);
        } catch (_) { /* fall through to reject */ }
        callback(null, false);
      },
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




// Save processed document with ADVANCED chunking
app.post('/api/documents/save', requireAuth, requireMinRole('developer'), async (req, res) => {
  try {
    const { name, type, size, chunks, metadata } = req.body;
    
    if (!name || !chunks || !Array.isArray(chunks)) {
      return res.status(400).json({ error: 'Invalid document data' });
    }

    console.log('[Upload] ============ ADVANCED PROCESSING START ============');
    console.log('[Upload] File:', name);
    console.log('[Upload] Type:', type);
    console.log('[Upload] Original chunks received:', chunks.length);

    const isPublic = req.user.role === 'admin' ? 1 : 0;
    
    // Reconstruct full text from uploaded chunks
    const fullText = chunks.map(c => c.text).join('');
    console.log('[Upload] Full text length:', fullText.length, 'chars');
    
    // For CSV files, also store original content (for predictions feature)
    let originalContent = null;
    const isCSV = type === 'text/csv' || 
                  type === 'text/plain' || 
                  name.toLowerCase().endsWith('.csv') ||
                  name.toLowerCase().endsWith('.tsv');
    
    if (isCSV) {
      originalContent = fullText;
      console.log('[Upload] ✅ Storing original CSV content for predictions');
    }
    
    // ADVANCED PROCESSING - Create high-quality chunks using advanced processor
    console.log('[Upload] Running advanced document processor...');
    const processedChunks = processDocumentAdvanced(fullText, type, name);
    
    console.log('[Upload] ✅ Advanced processing complete');
    console.log('[Upload] Enhanced chunks created:', processedChunks.length);
    
    // Save document metadata to database
    const docResult = documentQueries.create.run(
      req.user.id,
      name,
      type,
      size,
      JSON.stringify(metadata || {}),
      processedChunks.length,
      isPublic
    );
    
    const documentId = docResult.lastInsertRowid;
    console.log('[Upload] Document ID:', documentId);
    
    // Save all enhanced chunks to database
    for (let i = 0; i < processedChunks.length; i++) {
      const chunk = processedChunks[i];
      chunkQueries.create.run(
        documentId,
        i,
        chunk.text,
        JSON.stringify([]), // No pre-computed embeddings
        JSON.stringify(chunk.metadata || {})
      );
    }
    
    // Update document with original content if CSV (for predictions)
    if (originalContent) {
      db.prepare('UPDATE documents SET original_content = ? WHERE id = ?')
        .run(originalContent, documentId);
      console.log('[Upload] ✅ Updated with original CSV content');
    }
    
    // Log activity
    activityQueries.log.run(
      req.user.id,
      'DOCUMENT_SAVED',
      `Saved: ${name} with ${processedChunks.length} advanced chunks`,
      req.ip
    );
    
    console.log('[Upload] ============ PROCESSING COMPLETE ============\n');
    
    res.json({ 
      success: true, 
      documentId,
      isPublic,
      chunksCreated: processedChunks.length,
      enhanced: true
    });
    
  } catch (error) {
    console.error('[Upload] ERROR:', error);
    console.error('[Upload] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to save document', 
      message: error.message 
    });
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

// ==================== WEB URL FETCHING ROUTE (NEW) ====================

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

    // Fetch the web page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LocalLLMBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse and extract main content using Readability
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      // Fallback: extract all text from body
      const bodyText = dom.window.document.body.textContent || '';
      const cleanText = bodyText
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      if (!cleanText || cleanText.length < 100) {
        return res.status(400).json({ 
          error: 'Could not extract meaningful content from URL. Page might be behind authentication or use JavaScript rendering.' 
        });
      }

      return res.json({
        content: cleanText,
        title: dom.window.document.title || validUrl.hostname,
        url: url,
        excerpt: cleanText.substring(0, 200) + '...'
      });
    }

    // Clean the extracted text
    let content = article.textContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    // Add title and metadata to content
    const fullContent = `
# ${article.title || 'Web Page'}

URL: ${url}
Fetched: ${new Date().toISOString()}

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
      title: article.title || validUrl.hostname,
      url: url,
      excerpt: article.excerpt || content.substring(0, 200) + '...',
      length: fullContent.length,
      author: article.byline || null
    });

  } catch (error) {
    console.error('❌ URL fetch error:', error);
    
    // Provide helpful error messages
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Request timed out. The website might be slow or unreachable.' 
      });
    }

    if (error.message.includes('HTTP 403') || error.message.includes('HTTP 401')) {
      return res.status(403).json({ 
        error: 'Access denied. The website might require authentication or block automated access.' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch URL',
      message: error.message 
    });
  }
});

// ==================== CONVERSATION HISTORY ROUTES ====================

// Get all conversations for current user (ALL ROLES including viewer)
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

// Get single conversation with messages (ALL ROLES)
app.get('/api/conversations/:id', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    // Get conversation details
    const conversation = conversationQueries.getById.get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get messages for this conversation
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

// Create new conversation (ALL ROLES - REMOVED requireMinRole)
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

// Add message to conversation (ALL ROLES - REMOVED requireMinRole)
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
    
    // Verify conversation belongs to user
    const conversation = conversationQueries.getById.get(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Add message
    const result = conversationQueries.addMessage.run(conversationId, role, content);
    
    // Update conversation timestamp
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

// Update conversation title (ALL ROLES)
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

/**
 * Build context from analytics result
 */

// ============================================================
// DETERMINISTIC QUERY ENGINE - HELPER FUNCTIONS
// ============================================================

/**
 * Check if query is a data query that needs deterministic processing
 */
function checkIfDataQuery(query) {
  const lower = query.toLowerCase();
  
  const dataPatterns = [
    /\b(count|how many|number of)\b/,
    /\b(sum|total|calculate)\b/,
    /\b(average|mean|avg)\b/,
    /\b(max|maximum|highest|largest|top)\b/,
    /\b(min|minimum|lowest|smallest|bottom)\b/,
    /\b(list|show|display|find|get).*\b(all|where|with)\b/,
    /\b(filter|select)\b/,
    /\b(group by|breakdown|categorize)\b/
  ];
  
  return dataPatterns.some(pattern => pattern.test(lower));
}

/**
 * Build context from deterministic query result
 */
function buildQueryResultContext(result, query) {
  let context = `DATA QUERY RESULT\nQuery: ${query}\n\n`;
  
  switch (result.operation) {
    case 'count':
      if (result.groupBy) {
        context += `COUNT BY ${result.groupBy}:\n`;
        result.groups.forEach(g => {
          context += `  ${g[result.groupBy]}: ${g.count}\n`;
        });
        context += `\nTOTAL: ${result.total}\n`;
      } else {
        context += `COUNT: ${result.count}\n`;
        if (result.distinct) {
          context += `DISTINCT VALUES: ${result.count}\n`;
          if (result.values) {
            context += `Values: ${result.values.slice(0, 20).join(', ')}${result.values.length > 20 ? '...' : ''}\n`;
          }
        }
        if (result.filters && result.filters.length > 0) {
          context += `\nFilters Applied:\n`;
          result.filters.forEach(f => {
            context += `  - ${f.column} ${f.operator} "${f.value}"\n`;
          });
        }
      }
      break;
      
    case 'sum':
      context += `SUM of ${result.column}: ${result.sum.toLocaleString()}\n`;
      context += `Count: ${result.count} rows\n`;
      break;
      
    case 'avg':
      context += `AVERAGE of ${result.column}: ${result.average.toFixed(2)}\n`;
      context += `Count: ${result.count} rows\n`;
      context += `Range: ${result.min} - ${result.max}\n`;
      break;
      
    case 'max':
      context += `MAXIMUM ${result.column}: ${result.maximum}\n`;
      if (result.topRecords && result.topRecords.length > 0) {
        context += `\nTop ${result.count} Records:\n`;
        result.topRecords.forEach((record, i) => {
          context += `${i + 1}. ${JSON.stringify(record)}\n`;
        });
      }
      break;
      
    case 'min':
      context += `MINIMUM ${result.column}: ${result.minimum}\n`;
      if (result.bottomRecords && result.bottomRecords.length > 0) {
        context += `\nBottom ${result.count} Records:\n`;
        result.bottomRecords.forEach((record, i) => {
          context += `${i + 1}. ${JSON.stringify(record)}\n`;
        });
      }
      break;
      
    case 'select':
      context += `SELECTED ${result.count} ROWS:\n\n`;
      const displayRows = result.rows.slice(0, 50);
      displayRows.forEach((row, i) => {
        context += `${i + 1}. ${JSON.stringify(row)}\n`;
      });
      if (result.count > 50) {
        context += `\n... and ${result.count - 50} more rows\n`;
      }
      break;
      
    case 'group':
      context += `GROUPED BY ${result.groupBy}:\n\n`;
      result.groups.forEach(g => {
        context += `${g[result.groupBy]}: ${g.count} items\n`;
      });
      context += `\nTotal Groups: ${result.totalGroups}\n`;
      context += `Total Rows: ${result.totalRows}\n`;
      break;

    case 'pdf_lookup':
      context += `PDF FIELD LOOKUP:\n\n`;
      result.results.forEach((r, i) => {
        context += `${i + 1}. ${r.field}: ${r.value}\n`;
        context += `   Source: ${r.source}\n\n`;
      });
      context += `\nTotal matches: ${result.count}\n`;
      break;  
      
    default:
      context += JSON.stringify(result, null, 2);
  }
  
  return context;
}

// /**
//  * Build system prompt for deterministic query result
//  */
// function buildQueryResultPrompt(context, result) {
//   return `You are a data analyst assistant. A precise data query was executed on the user's documents.

// **CRITICAL INSTRUCTIONS:**
// 1. The query result below is 100% accurate - it came from actual data processing, NOT estimation
// 2. Present the results clearly and concisely
// 3. Use the EXACT numbers from the result - do not round or estimate unless asked
// 4. Format numbers with commas for readability (e.g., 1,234.56)
// 5. If showing a list, format it clearly with bullets or numbered format
// 6. Do NOT add information that isn't in the result
// 7. Be specific and direct
// 8. If the user asked for a list, provide the complete list from the data
// 9. If the user asked for a count, state the exact count

// **QUERY EXECUTION RESULT:**
// ${context}

// ---

// Present this result to the user in a clear, professional format. Remember: These are EXACT values from the data, not estimates.`;
// }


function buildQueryResultPrompt(context, result) {
  let instructions = `You are a data analyst assistant. A precise data query was executed on the user's documents.

**CRITICAL INSTRUCTIONS:**
1. The query result below is 100% accurate - it came from actual data processing
2. Present the results clearly and concisely
3. Use the EXACT values from the result
4. Format numbers with commas for readability (e.g., 1,234.56)
5. If showing a list, format it clearly with bullets or numbered format
6. Do NOT add information that isn't in the result
7. Be specific and direct
8. If the user asked for a list, provide the complete list from the data
9. If the user asked for a count, state the exact count`;

  // ADD THIS:
  if (result.operation === 'pdf_lookup') {
    instructions += `
10. For PDF lookups, provide the field value directly
11. If multiple matches, list all of them
12. Quote the exact value from the document`;
  }
  
  instructions += `

**QUERY EXECUTION RESULT:**
${context}

---

Present this result to the user in a clear, professional format.`;

  return instructions;
}



// Keep existing analytics helper functions for backward compatibility
function buildAnalyticsContext(analyticsResult, query) {
  let context = `ANALYTICS QUERY RESULT\nQuery: ${query}\n\n`;
  
  switch (analyticsResult.operation) {
    case 'count':
      context += `COUNT: ${analyticsResult.count}\n`;
      if (analyticsResult.filters && analyticsResult.filters.length > 0) {
        context += `Filters Applied:\n`;
        analyticsResult.filters.forEach(f => {
          context += `  - ${f.column} ${f.operator} "${f.value}"\n`;
        });
      }
      break;
      
    case 'sum':
      context += `SUM of ${analyticsResult.column}: ${analyticsResult.sum.toLocaleString()}\n`;
      context += `Records counted: ${analyticsResult.count}\n`;
      break;
      
    case 'average':
      context += `AVERAGE of ${analyticsResult.column}: ${analyticsResult.average.toFixed(2)}\n`;
      context += `Records analyzed: ${analyticsResult.count}\n`;
      break;
      
    case 'max':
      context += `MAXIMUM ${analyticsResult.column}: ${analyticsResult.maximum}\n`;
      if (analyticsResult.topRecords && analyticsResult.topRecords.length > 0) {
        context += `\nTop Records:\n`;
        analyticsResult.topRecords.slice(0, 5).forEach((record, i) => {
          context += `${i + 1}. ${JSON.stringify(record)}\n`;
        });
      }
      break;
      
    case 'min':
      context += `MINIMUM ${analyticsResult.column}: ${analyticsResult.minimum}\n`;
      if (analyticsResult.bottomRecords && analyticsResult.bottomRecords.length > 0) {
        context += `\nBottom Records:\n`;
        analyticsResult.bottomRecords.slice(0, 5).forEach((record, i) => {
          context += `${i + 1}. ${JSON.stringify(record)}\n`;
        });
      }
      break;
      
    case 'list':
      context += `LIST (${analyticsResult.count} items):\n\n`;
      analyticsResult.items.slice(0, 20).forEach((item, i) => {
        context += `${i + 1}. ${JSON.stringify(item)}\n`;
      });
      if (analyticsResult.items.length > 20) {
        context += `... and ${analyticsResult.items.length - 20} more items\n`;
      }
      break;
      
    case 'compare':
      context += `COMPARISON RESULTS:\n\n`;
      if (analyticsResult.summary) {
        analyticsResult.summary.forEach(group => {
          context += `${group.group}: ${group.count} items\n`;
        });
      }
      break;
      
    default:
      context += `Operation: ${analyticsResult.operation}\n`;
      context += JSON.stringify(analyticsResult, null, 2);
  }
  
  context += `\nTotal rows processed: ${analyticsResult.rowsProcessed || 0}\n`;
  
  return context;
}

/**
 * Build system prompt for analytics response
 */
function buildAnalyticsPrompt(context, analyticsResult) {
  return `You are a data analytics assistant. You have performed precise data analysis on the user's documents.

**CRITICAL INSTRUCTIONS:**
1. Present the analytics results clearly and directly
2. Use the EXACT numbers and values from the analysis result
3. Format numbers with commas for readability (e.g., 1,234)
4. For lists, use bullet points or numbered format
5. For tables, format as readable text
6. Answer ONLY based on the analytics results - do not estimate or make up numbers
7. Be concise and specific

**ANALYTICS RESULTS:**
${context}

---

Present these results to the user in a clear, professional format.`;
}



// Chat RAG endpoint with DETERMINISTIC QUERY ENGINE
app.post('/api/chat/rag', requireAuth, async (req, res) => {
  try {
    let { message, documentIds, maxChunks = 5 } = req.body;
    
    // Normalize documentIds to always be an array
    if (documentIds && !Array.isArray(documentIds)) {
      documentIds = [documentIds];
    }
    
    console.log('[Chat RAG] ============================================');
    console.log('[Chat RAG] NEW REQUEST');
    console.log('[Chat RAG] Query:', message);
    console.log('[Chat RAG] Document IDs:', documentIds);
    console.log('[Chat RAG] ============================================');
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message required' });
    }
    
    // CHECK FOR GREETINGS - Skip all processing
    const greetings = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'bye', 'good morning', 'good afternoon', 'good evening'];
    const messageLower = message.toLowerCase().trim();
    
    if (greetings.some(g => messageLower === g) || (message.split(/\s+/).length < 3 && !/\b(what|when|where|who|how|why|list|show|count)\b/i.test(message))) {
      console.log('[Chat RAG] ⚡ Greeting detected - skipping processing');
      return res.json({
        systemPrompt: `You are a helpful AI assistant. Respond naturally to greetings and simple interactions.`,
        context: '',
        relevantChunks: [],
        documentNames: [],
        ragUsed: false,
        analyticsUsed: false,
        queryType: 'greeting',
        message: 'Greeting detected'
      });
    }
    
    // ✅ NEW: CHECK IF THIS IS A DATA QUERY (highest priority for accuracy)
    const isDataQuery = checkIfDataQuery(message);
    console.log('[Chat RAG] Is data query:', isDataQuery);
    
    if (isDataQuery && documentIds && documentIds.length > 0) {
      console.log('[Chat RAG] 🎯 Running DETERMINISTIC QUERY engine...');
      
      try {
        const queryResult = await processDataQuery(message, documentIds);
        
        if (queryResult) {
          console.log('[Chat RAG] ✅ Deterministic query executed successfully');
          console.log('[Chat RAG] Operation:', queryResult.operation);
          console.log('[Chat RAG] Result summary:', JSON.stringify({
            operation: queryResult.operation,
            count: queryResult.count || queryResult.rows?.length,
            hasData: true
          }));
          
          // Get document names
          const userDocuments = documentQueries.findAll.all(req.user.id);
          const docNames = userDocuments
            .filter(d => documentIds.includes(d.id))
            .map(d => d.filename);
          
          // Build response context
          const context = buildQueryResultContext(queryResult, message);
          const systemPrompt = buildQueryResultPrompt(context, queryResult);
          
          console.log('[Chat RAG] 📤 Returning deterministic result');
          
          return res.json({
            systemPrompt: systemPrompt,
            context: context,
            relevantChunks: [],
            documentNames: docNames,
            ragUsed: true,
            analyticsUsed: true,
            queryResult: queryResult,
            queryType: 'data_query',
            message: 'Deterministic query executed successfully'
          });
        } else {
          console.log('[Chat RAG] ⚠️ Deterministic query returned null, falling back to RAG');
        }
      } catch (queryError) {
        console.error('[Chat RAG] Deterministic query error:', queryError);
        console.error('[Chat RAG] Stack:', queryError.stack);
        console.log('[Chat RAG] Falling back to regular RAG');
      }
    }
    
    // REGULAR RAG PATH (if not data query or query failed)
    console.log('[Chat RAG] 🔍 Running REGULAR RAG...');
    
    // Analyze query
    const queryAnalysis = analyzeQuery(message);
    console.log('[Chat RAG] Query type:', queryAnalysis.questionType);
    
    // Get document names
    const userDocuments = documentQueries.findAll.all(req.user.id);
    const docNames = userDocuments
      .filter(d => documentIds && documentIds.includes(d.id))
      .map(d => d.filename);
    
    let relevantChunks = [];
    let context = '';
    let systemPrompt = '';
    
    if (documentIds && documentIds.length > 0) {
      // Search for relevant chunks
      relevantChunks = searchRelevantChunksAdvanced(message, documentIds, maxChunks);
      
      console.log('[Chat RAG] Chunks found:', relevantChunks.length);
      
      if (relevantChunks.length > 0) {
        context = buildOptimizedContext(relevantChunks, 2000);
        systemPrompt = buildEnhancedSystemPrompt(context, docNames, queryAnalysis.questionType);
        
        console.log('[Chat RAG] ✅ Context built:', context.length, 'characters');
      } else {
        console.log('[Chat RAG] ⚠️ No relevant chunks found');
        systemPrompt = `You are a helpful AI assistant. The user asked about documents, but no relevant information was found in the available documents. Politely inform them that the information they're looking for is not in the documents.`;
      }
    } else {
      systemPrompt = `You are a helpful AI assistant. Answer the user's question to the best of your ability.`;
    }
    
    console.log('[Chat RAG] 📤 Returning RAG response');
    
    res.json({
      systemPrompt,
      context,
      relevantChunks: relevantChunks.map(c => ({
        text: c.chunk_text.substring(0, 200) + (c.chunk_text.length > 200 ? '...' : ''),
        score: c.finalScore || c.relevance_score || 0,
        document_id: c.document_id,
        chunk_index: c.chunk_index
      })),
      documentNames: docNames,
      ragUsed: relevantChunks.length > 0,
      analyticsUsed: false,
      queryType: queryAnalysis.questionType,
      message: 'RAG context prepared'
    });
    
  } catch (error) {
    console.error('[Chat RAG] ERROR:', error);
    console.error('[Chat RAG] Stack:', error.stack);
    res.status(500).json({ 
      error: 'RAG chat failed', 
      details: error.message 
    });
  }
});

// Save assistant response to conversation
app.post('/api/chat/save-response', requireAuth, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    
    if (!conversationId || !content) {
      return res.status(400).json({ error: 'Conversation ID and content required' });
    }
    
    // Verify conversation belongs to user
    const conversation = conversationQueries.getById.get(conversationId, req.user.id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Save assistant message
    const result = conversationQueries.addMessage.run(conversationId, 'assistant', content);
    conversationQueries.updateTimestamp.run(conversationId);
    
    res.json({
      success: true,
      messageId: result.lastInsertRowid
    });
    
  } catch (error) {
    console.error('[Chat] Error saving response:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// ===========================================================

// Delete conversation (ALL ROLES)
app.delete('/api/conversations/:id', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.id;
    
    // Get conversation title for logging before deletion
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

// Search conversations (ALL ROLES)
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

// Bulk save conversation (ALL ROLES - REMOVED requireMinRole)
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
    
    // Create conversation
    const result = conversationQueries.create.run(userId, title);
    const conversationId = result.lastInsertRowid;
    
    // Insert all messages
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

// ============ OLLAMA PROXY (ALL AUTHENTICATED USERS) ============

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



// ═══════════════════════════════════════════════════════
//  PREDICTIVE ANALYTICS ROUTES
// ═══════════════════════════════════════════════════════

//import { analyzeTimeSeries, extractNumericData } from './analytics-engine.js';

// Analyze time series data
app.post('/api/analytics/predict', requireAuth, async (req, res) => {
  try {
    const { data, options } = req.body;
    
    if (!Array.isArray(data) || data.length < 3) {
      return res.status(400).json({ 
        error: 'Please provide at least 3 data points as an array' 
      });
    }
    
    // Perform analysis
    const analysis = analyzeTimeSeries(data, options);
    
    // Log activity
    activityQueries.log.run(
      req.user.id,
      'PREDICTION_RUN',
      `Analyzed ${data.length} data points, forecast ${options?.forecastPeriods || 7} periods`,
      req.ip
    );
    
    res.json(analysis);
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// Extract numeric data from document text
app.post('/api/analytics/extract', requireAuth, async (req, res) => {
  try {
    const { text, documentId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text content required' });
    }
    
    const extracted = extractNumericData(text);
    
    res.json({
      success: true,
      data: extracted,
      summary: {
        pricesFound: extracted.prices.length,
        datesFound: extracted.dates.length,
        percentagesFound: extracted.percentages.length,
        volumesFound: extracted.volumes.length
      }
    });
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: 'Extraction failed' });
  }
});

// Smart prediction from document chunks
app.post('/api/analytics/predict-from-doc', requireAuth, async (req, res) => {
  try {
    const { documentId, options } = req.body;
    
    console.log('[Analytics] ============ PREDICTION START ============');
    console.log('[Analytics] Document ID:', documentId);
    console.log('[Analytics] Options:', options);
    
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID required' });
    }
    
    // Get document info
    const document = documentQueries.findById.get(documentId);
    
    if (!document) {
      console.log('[Analytics] Document not found:', documentId);
      return res.status(404).json({ error: 'Document not found' });
    }
    
    console.log('[Analytics] Document found:', document.filename);
    console.log('[Analytics] File type:', document.file_type);
    console.log('[Analytics] Has original_content:', !!document.original_content);
    
    // Check if user has access (owns document or it's public)
    if (document.user_id !== req.user.id && document.is_public !== 1) {
      return res.status(403).json({ error: 'Access denied to this document' });
    }
    
    // Get text content - prefer original_content for CSV files
    let fullText;
    
    if (document.original_content) {
      console.log('[Analytics] ✅ Using stored original content (accurate CSV parsing)');
      fullText = document.original_content;
    } else {
      console.log('[Analytics] ⚠️  No original content, reconstructing from chunks (may be less accurate)');
      const chunks = chunkQueries.findByDocumentId.all(documentId);
      
      if (chunks.length === 0) {
        return res.status(404).json({ 
          error: 'Document has no content',
          hint: 'Try re-uploading this document'
        });
      }
      
      // Reconstruct and clean up
      if (chunks.length === 1) {
        fullText = chunks[0].chunk_text;
      } else {
        const chunkTexts = chunks.map(c => c.chunk_text.trim());
        fullText = chunkTexts.join('\n');
        
        // Remove duplicate headers
        const lines = fullText.split('\n');
        const headerPattern = /^Date.*(?:Price|Close|Open|High|Low)/i;
        const cleanedLines = [];
        let headerFound = false;
        
        for (const line of lines) {
          if (headerPattern.test(line)) {
            if (!headerFound) {
              cleanedLines.push(line);
              headerFound = true;
            }
          } else if (line.trim().length > 0) {
            cleanedLines.push(line);
          }
        }
        
        fullText = cleanedLines.join('\n');
      }
    }
    
    console.log('[Analytics] Full text length:', fullText.length);
    console.log('[Analytics] Number of lines:', fullText.split('\n').length);
    console.log('[Analytics] First 500 chars:\n', fullText.substring(0, 500));
    
    // Extract numeric data
    const extracted = extractNumericData(fullText);
    
    console.log('[Analytics] ============ EXTRACTION RESULTS ============');
    console.log('[Analytics] Prices extracted:', extracted.prices.length);
    console.log('[Analytics] First 10 prices:', extracted.prices.slice(0, 10));
    console.log('[Analytics] Last 5 prices:', extracted.prices.slice(-5));
    
    if (extracted.prices.length > 0) {
      const minPrice = Math.min(...extracted.prices);
      const maxPrice = Math.max(...extracted.prices);
      const avgPrice = extracted.prices.reduce((a, b) => a + b, 0) / extracted.prices.length;
      
      console.log('[Analytics] Price statistics:');
      console.log('[Analytics]   Min:', minPrice);
      console.log('[Analytics]   Max:', maxPrice);
      console.log('[Analytics]   Avg:', avgPrice.toFixed(2));
      console.log('[Analytics]   Range:', (maxPrice - minPrice).toFixed(2));
    }
    
    // Validate
    if (extracted.prices.length < 3) {
      return res.status(400).json({ 
        error: 'Insufficient numeric data found in document',
        found: extracted.prices.length,
        minimum: 3,
        hint: 'Make sure your document contains at least 3 numeric values (prices, quantities, etc.)',
        debug: {
          textPreview: fullText.substring(0, 500),
          extractedSample: extracted.prices
        }
      });
    }
    
    // Additional validation: Check for suspicious data
    const minPrice = Math.min(...extracted.prices);
    const maxPrice = Math.max(...extracted.prices);
    const avgPrice = extracted.prices.reduce((a, b) => a + b, 0) / extracted.prices.length;
    
    // If we have extreme outliers, apply strict filtering
    if (minPrice < 100 && maxPrice > 10000) {
      console.log('[Analytics] ⚠️  Suspicious price range detected, applying strict filter...');
      const strictPrices = extracted.prices.filter(p => p >= 100 && p <= 100000);
      
      if (strictPrices.length >= 3) {
        console.log('[Analytics] Strict filter: kept', strictPrices.length, 'of', extracted.prices.length, 'prices');
        extracted.prices = strictPrices;
      }
    }
    
    // Run analysis
    console.log('[Analytics] Running time series analysis...');
    const analysis = analyzeTimeSeries(extracted.prices, options);
    
    console.log('[Analytics] ============ ANALYSIS COMPLETE ============');
    console.log('[Analytics] Volatility:', analysis.volatility.current);
    console.log('[Analytics] Support:', analysis.levels.support);
    console.log('[Analytics] Resistance:', analysis.levels.resistance);
    console.log('[Analytics] ============================================\n');
    
    res.json({
      ...analysis,
      documentData: {
        documentId,
        documentName: document.filename,
        dataPoints: extracted.prices.length,
        usedOriginalContent: !!document.original_content,
        dateRange: extracted.dates.length > 0 ? {
          first: extracted.dates[0],
          last: extracted.dates[extracted.dates.length - 1]
        } : null
      }
    });
    
  } catch (error) {
    console.error('[Analytics] ERROR:', error);
    console.error('[Analytics] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Prediction failed',
      details: error.message
    });
  }
});



// ═══════════════════════════════════════════════════════════════
//  PREDICTIVE ANALYTICS ROUTES
//  
//  Add these routes to server/index.js BEFORE the health check route
//  (around line 898)
//  
//  IMPORTANT: Also add this import at the TOP of server/index.js:
//  const { analyzeTimeSeries, extractNumericData } = require('./analytics-engine.js');
// ═══════════════════════════════════════════════════════════════

// Analyze time series data (manual entry)
app.post('/api/analytics/predict', requireAuth, async (req, res) => {
  try {
    const { data, options } = req.body;
    
    console.log('[Analytics] Predict request:', { dataPoints: data?.length, options });
    
    if (!Array.isArray(data) || data.length < 3) {
      return res.status(400).json({ 
        error: `Please provide at least 3 data points. Received: ${data?.length || 0}` 
      });
    }
    
    // Perform analysis
    const analysis = analyzeTimeSeries(data, options);
    
    console.log('[Analytics] Analysis complete:', { 
      forecastPeriods: analysis.forecast?.periods,
      confidence: analysis.forecast?.confidence 
    });
    
    // Log activity
    activityQueries.log.run(
      req.user.id,
      'PREDICTION_RUN',
      `Analyzed ${data.length} data points, forecast ${options?.forecastPeriods || 7} periods`,
      req.ip
    );
    
    res.json(analysis);
  } catch (error) {
    console.error('[Analytics] Prediction error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Extract numeric data from document text
app.post('/api/analytics/extract', requireAuth, async (req, res) => {
  try {
    const { text, documentId } = req.body;
    
    console.log('[Analytics] Extract request:', { 
      textLength: text?.length,
      documentId 
    });
    
    if (!text) {
      return res.status(400).json({ error: 'Text content required' });
    }
    
    const extracted = extractNumericData(text);
    
    console.log('[Analytics] Extraction complete:', {
      prices: extracted.prices.length,
      dates: extracted.dates.length
    });
    
    res.json({
      success: true,
      data: extracted,
      summary: {
        pricesFound: extracted.prices.length,
        datesFound: extracted.dates.length,
        percentagesFound: extracted.percentages.length,
        volumesFound: extracted.volumes.length
      }
    });
  } catch (error) {
    console.error('[Analytics] Extraction error:', error);
    res.status(500).json({ 
      error: 'Extraction failed',
      message: error.message 
    });
  }
});

// Smart prediction from document chunks
app.post('/api/analytics/predict-from-doc', requireAuth, async (req, res) => {
  try {
    const { documentId, options } = req.body;
    
    console.log('[Analytics] Predict from doc request:', { documentId, options });
    
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID required' });
    }
    
    // Get document chunks
    const chunks = chunkQueries.getByDocumentId.all(documentId);
    
    console.log('[Analytics] Found chunks:', chunks.length);
    
    if (chunks.length === 0) {
      return res.status(404).json({ 
        error: 'Document not found or has no content',
        documentId 
      });
    }
    
    // Extract text from all chunks
    const fullText = chunks.map(c => c.chunk_text).join('\n');
    
    console.log('[Analytics] Full text length:', fullText.length);
    console.log('[Analytics] First 200 chars:', fullText.substring(0, 200));
    
    // Extract numeric data
    const extracted = extractNumericData(fullText);
    
    console.log('[Analytics] Extracted data:', {
      prices: extracted.prices.length,
      dates: extracted.dates.length,
      percentages: extracted.percentages.length,
      volumes: extracted.volumes.length
    });
    
    if (extracted.prices.length > 0) {
      console.log('[Analytics] Sample prices:', extracted.prices.slice(0, 10));
    }
    
    if (extracted.prices.length < 3) {
      return res.status(400).json({ 
        error: `Insufficient numeric data found in document. Found ${extracted.prices.length} values, need at least 3.`,
        hint: 'Document should contain clear numbers like: $123.45, 100, 200, 300 or similar formats',
        found: {
          prices: extracted.prices.length,
          dates: extracted.dates.length,
          percentages: extracted.percentages.length,
          volumes: extracted.volumes.length
        },
        minimum: 3,
        sampleText: fullText.substring(0, 500)
      });
    }
    
    // Run analysis
    const analysis = analyzeTimeSeries(extracted.prices, options);
    
    console.log('[Analytics] Analysis complete for document');
    
    // Log activity
    activityQueries.log.run(
      req.user.id,
      'PREDICTION_DOC',
      `Analyzed document ${documentId}, found ${extracted.prices.length} data points`,
      req.ip
    );
    
    res.json({
      ...analysis,
      documentData: {
        documentId,
        dataPoints: extracted.prices.length,
        dateRange: extracted.dates.length > 0 ? {
          first: extracted.dates[0],
          last: extracted.dates[extracted.dates.length - 1]
        } : null,
        extractedPrices: extracted.prices.slice(0, 20) // Include first 20 for debugging
      }
    });
    
  } catch (error) {
    console.error('[Analytics] Document prediction error:', error);
    console.error('[Analytics] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Prediction failed', 
      message: error.message,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


// Health check (no auth required)
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
║  Web Fetch:     ✅ ENABLED (Admin/Developer)               ║
║                                                            ║
║  Default Admin: admin / admin123                          ║
║  ⚠️  CHANGE DEFAULT PASSWORD IMMEDIATELY!                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});