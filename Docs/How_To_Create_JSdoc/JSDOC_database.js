/**
 * @fileoverview SQLite Database Configuration and Query Definitions
 * @module server/database
 * @requires better-sqlite3
 * 
 * This module initializes the SQLite database and exports prepared statements
 * for all database operations. Uses better-sqlite3 for synchronous database access.
 * 
 * Database Schema:
 * - users: User accounts with role-based access
 * - sessions: Active user sessions
 * - documents: Uploaded documents metadata
 * - chunks: Document text chunks with embeddings
 * - conversations: Chat conversation threads
 * - messages: Individual messages in conversations
 * - activity_logs: Audit trail of user actions
 * 
 * @author Your Team
 * @version 2.0.0
 */

import Database from 'better-sqlite3';

/**
 * SQLite database instance
 * @type {Database.Database}
 * @constant
 */
const db = new Database('./data/localllm.db', { verbose: console.log });

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

/**
 * Initialize database schema with all required tables and indexes
 * Creates tables if they don't exist. Safe to run multiple times.
 * 
 * Tables created:
 * - users: User accounts
 * - sessions: Active sessions
 * - documents: Document metadata
 * - chunks: Text chunks with vector embeddings
 * - conversations: Conversation threads
 * - messages: Chat messages
 * - activity_logs: Audit logs
 */
db.exec(`
  -- Users table with role-based access control
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL CHECK(role IN ('admin', 'developer', 'viewer')) DEFAULT 'viewer',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- Sessions table for user authentication
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Documents table for uploaded files
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    metadata TEXT,
    chunks_count INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Chunks table for document text segments with embeddings
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  -- Conversations table for chat history
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Messages table for conversation content
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  -- Activity logs for audit trail
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Performance indexes
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_documents_is_public ON documents(is_public);
  CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at DESC);
`);

/**
 * User management prepared statements
 * @namespace userQueries
 */
export const userQueries = {
  /**
   * Find user by ID
   * @type {Database.Statement}
   * @param {number} id - User ID
   * @returns {Object|null} User object or null
   */
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),

  /**
   * Find user by username
   * @type {Database.Statement}
   * @param {string} username - Username
   * @returns {Object|null} User object or null
   */
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),

  /**
   * Get all users
   * @type {Database.Statement}
   * @returns {Array<Object>} Array of user objects
   */
  getAll: db.prepare('SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'),

  /**
   * Create new user
   * @type {Database.Statement}
   * @param {string} username - Username (unique)
   * @param {string} password - Hashed password
   * @param {string|null} email - Email address
   * @param {string|null} full_name - Full name
   * @param {string} role - User role (admin|developer|viewer)
   * @param {number} is_active - Active status (1=active, 0=inactive)
   * @returns {Object} Insert result with lastInsertRowid
   */
  create: db.prepare('INSERT INTO users (username, password, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)'),

  /**
   * Update user details
   * @type {Database.Statement}
   * @param {string|null} email - Email address
   * @param {string|null} full_name - Full name
   * @param {string} role - User role
   * @param {number} is_active - Active status
   * @param {number} id - User ID
   * @returns {Object} Update result with changes count
   */
  update: db.prepare('UPDATE users SET email = ?, full_name = ?, role = ?, is_active = ? WHERE id = ?'),

  /**
   * Update user password
   * @type {Database.Statement}
   * @param {string} password - New hashed password
   * @param {number} id - User ID
   * @returns {Object} Update result
   */
  updatePassword: db.prepare('UPDATE users SET password = ? WHERE id = ?'),

  /**
   * Update last login timestamp
   * @type {Database.Statement}
   * @param {number} id - User ID
   * @returns {Object} Update result
   */
  updateLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),

  /**
   * Delete user
   * @type {Database.Statement}
   * @param {number} id - User ID
   * @returns {Object} Delete result
   */
  delete: db.prepare('DELETE FROM users WHERE id = ?')
};

/**
 * Session management prepared statements
 * @namespace sessionQueries
 */
export const sessionQueries = {
  /**
   * Find session by ID
   * @type {Database.Statement}
   * @param {string} id - Session ID
   * @returns {Object|null} Session object or null
   */
  findById: db.prepare('SELECT * FROM sessions WHERE id = ?'),

  /**
   * Create new session
   * @type {Database.Statement}
   * @param {string} id - Session ID (UUID)
   * @param {number} user_id - User ID
   * @param {string} expires_at - Expiration timestamp
   * @returns {Object} Insert result
   */
  create: db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'),

  /**
   * Delete session by ID
   * @type {Database.Statement}
   * @param {string} id - Session ID
   * @returns {Object} Delete result
   */
  deleteById: db.prepare('DELETE FROM sessions WHERE id = ?'),

  /**
   * Delete expired sessions
   * @type {Database.Statement}
   * @returns {Object} Delete result with changes count
   */
  deleteExpired: db.prepare('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP')
};

/**
 * Activity logging prepared statements
 * @namespace activityQueries
 */
export const activityQueries = {
  /**
   * Log user activity
   * @type {Database.Statement}
   * @param {number} user_id - User ID
   * @param {string} action - Action name (e.g., 'LOGIN', 'UPLOAD_DOCUMENT')
   * @param {string} details - Action details
   * @param {string} ip_address - IP address
   * @returns {Object} Insert result
   */
  log: db.prepare('INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)'),

  /**
   * Get recent activity logs
   * @type {Database.Statement}
   * @param {number} limit - Number of records to return
   * @returns {Array<Object>} Array of activity log objects
   */
  getRecent: db.prepare(`
    SELECT 
      a.*,
      u.username
    FROM activity_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `)
};

/**
 * Document management prepared statements
 * @namespace documentQueries
 */
export const documentQueries = {
  /**
   * Find document by ID
   * @type {Database.Statement}
   * @param {number} id - Document ID
   * @returns {Object|null} Document object or null
   */
  findById: db.prepare('SELECT * FROM documents WHERE id = ?'),

  /**
   * Find all documents accessible to user
   * Returns own documents + public documents (from admin)
   * @type {Database.Statement}
   * @param {number} user_id - User ID
   * @returns {Array<Object>} Array of document objects
   */
  findAll: db.prepare(`
    SELECT * FROM documents 
    WHERE user_id = ? OR is_public = 1 
    ORDER BY created_at DESC
  `),

  /**
   * Create new document
   * @type {Database.Statement}
   * @param {number} user_id - User ID
   * @param {string} filename - File name
   * @param {string} file_type - File type
   * @param {number} file_size - File size in bytes
   * @param {string} metadata - JSON metadata
   * @param {number} chunks_count - Number of chunks
   * @param {number} is_public - Public flag (1=public, 0=private)
   * @returns {Object} Insert result with lastInsertRowid
   */
  create: db.prepare(`
    INSERT INTO documents (user_id, filename, file_type, file_size, metadata, chunks_count, is_public) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  /**
   * Delete document
   * @type {Database.Statement}
   * @param {number} id - Document ID
   * @returns {Object} Delete result
   */
  delete: db.prepare('DELETE FROM documents WHERE id = ?')
};

/**
 * Chunk management prepared statements
 * @namespace chunkQueries
 */
export const chunkQueries = {
  /**
   * Find all chunks for a document
   * @type {Database.Statement}
   * @param {number} document_id - Document ID
   * @returns {Array<Object>} Array of chunk objects
   */
  findByDocumentId: db.prepare('SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index'),

  /**
   * Create new chunk
   * @type {Database.Statement}
   * @param {number} document_id - Document ID
   * @param {number} chunk_index - Chunk index
   * @param {string} chunk_text - Chunk text content
   * @param {string} embedding - JSON array of embedding vector
   * @param {string} metadata - JSON metadata
   * @returns {Object} Insert result
   */
  create: db.prepare(`
    INSERT INTO chunks (document_id, chunk_index, chunk_text, embedding, metadata) 
    VALUES (?, ?, ?, ?, ?)
  `),

  /**
   * Delete all chunks for a document
   * @type {Database.Statement}
   * @param {number} document_id - Document ID
   * @returns {Object} Delete result
   */
  deleteByDocumentId: db.prepare('DELETE FROM chunks WHERE document_id = ?')
};

/**
 * Conversation management prepared statements
 * @namespace conversationQueries
 */
export const conversationQueries = {
  /**
   * Get all conversations for a user with message count
   * @type {Database.Statement}
   * @param {number} user_id - User ID
   * @returns {Array<Object>} Array of conversation objects with message_count
   */
  getByUserId: db.prepare(`
    SELECT 
      c.*,
      COUNT(m.id) as message_count,
      MAX(m.created_at) as last_message_at
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `),

  /**
   * Get single conversation
   * @type {Database.Statement}
   * @param {number} id - Conversation ID
   * @param {number} user_id - User ID (for access control)
   * @returns {Object|null} Conversation object or null
   */
  getById: db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?'),

  /**
   * Get messages for a conversation
   * @type {Database.Statement}
   * @param {number} conversation_id - Conversation ID
   * @returns {Array<Object>} Array of message objects
   */
  getMessages: db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'),

  /**
   * Create new conversation
   * @type {Database.Statement}
   * @param {number} user_id - User ID
   * @param {string} title - Conversation title
   * @returns {Object} Insert result with lastInsertRowid
   */
  create: db.prepare('INSERT INTO conversations (user_id, title) VALUES (?, ?)'),

  /**
   * Add message to conversation
   * @type {Database.Statement}
   * @param {number} conversation_id - Conversation ID
   * @param {string} role - Message role (user|assistant)
   * @param {string} content - Message content
   * @returns {Object} Insert result
   */
  addMessage: db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'),

  /**
   * Update conversation timestamp
   * @type {Database.Statement}
   * @param {number} conversation_id - Conversation ID
   * @returns {Object} Update result
   */
  updateTimestamp: db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'),

  /**
   * Update conversation title
   * @type {Database.Statement}
   * @param {string} title - New title
   * @param {number} id - Conversation ID
   * @param {number} user_id - User ID (for access control)
   * @returns {Object} Update result
   */
  updateTitle: db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'),

  /**
   * Delete conversation
   * @type {Database.Statement}
   * @param {number} id - Conversation ID
   * @param {number} user_id - User ID (for access control)
   * @returns {Object} Delete result
   */
  delete: db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?'),

  /**
   * Search conversations by title or content
   * @type {Database.Statement}
   * @param {number} user_id - User ID
   * @param {string} title_pattern - Title search pattern (with %)
   * @param {string} content_pattern - Content search pattern (with %)
   * @returns {Array<Object>} Array of matching conversations
   */
  search: db.prepare(`
    SELECT DISTINCT c.*, COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ? AND (
      c.title LIKE ? OR
      EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id AND content LIKE ?)
    )
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `)
};

/**
 * Create default users if they don't exist
 * Only runs on first database initialization
 */
const createDefaultUsers = () => {
  const adminExists = userQueries.findByUsername.get('admin');
  if (!adminExists) {
    import('bcryptjs').then(bcrypt => {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      userQueries.create.run('admin', hashedPassword, 'admin@example.com', 'System Administrator', 'admin', 1);
      
      const devPassword = bcrypt.hashSync('dev123', 10);
      userQueries.create.run('developer', devPassword, 'dev@example.com', 'Developer User', 'developer', 1);
      
      const viewPassword = bcrypt.hashSync('view123', 10);
      userQueries.create.run('viewer', viewPassword, 'viewer@example.com', 'Viewer User', 'viewer', 1);
      
      console.log('✅ Default users created');
    });
  }
};

createDefaultUsers();

/**
 * SQLite database instance for direct queries
 * @type {Database.Database}
 */
export default db;
