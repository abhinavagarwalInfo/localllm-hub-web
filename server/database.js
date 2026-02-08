import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create data directory if it doesn't exist
const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new Database(join(dataDir, 'localllm.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL CHECK(role IN ('admin', 'developer', 'viewer')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    metadata TEXT,
    chunks_count INTEGER,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS document_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- NEW: Conversation History Tables
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  -- Indexes for existing tables
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_documents_public ON documents(is_public);
  CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
  CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id);

  -- NEW: Indexes for conversation tables
  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
`);

console.log('✅ All database tables initialized');

// Create default admin user if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

if (userCount.count === 0) {
  console.log('🔐 Creating default admin user...');
  const defaultPassword = 'admin123'; // Change this!
  const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
  
  db.prepare(`
    INSERT INTO users (username, password, email, full_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('admin', hashedPassword, 'admin@localllm.com', 'Administrator', 'admin', 1);
  
  console.log('✅ Default admin user created');
  console.log('   Username: admin');
  console.log('   Password: admin123');
  console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
}

// User queries
export const userQueries = {
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getAll: db.prepare('SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'),
  create: db.prepare(`
    INSERT INTO users (username, password, email, full_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE users 
    SET email = ?, full_name = ?, role = ?, is_active = ?
    WHERE id = ?
  `),
  updatePassword: db.prepare('UPDATE users SET password = ? WHERE id = ?'),
  updateLastLogin: db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'),
  delete: db.prepare('DELETE FROM users WHERE id = ?'),
  toggleActive: db.prepare('UPDATE users SET is_active = ? WHERE id = ?')
};

// Session queries
export const sessionQueries = {
  create: db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'),
  findById: db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP'),
  deleteById: db.prepare('DELETE FROM sessions WHERE id = ?'),
  deleteExpired: db.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP'),
  deleteByUserId: db.prepare('DELETE FROM sessions WHERE user_id = ?')
};

// Document queries
export const documentQueries = {
  create: db.prepare(`
    INSERT INTO documents (user_id, filename, file_type, file_size, metadata, chunks_count, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  findByUserId: db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC'),
  findPublic: db.prepare('SELECT * FROM documents WHERE is_public = 1 ORDER BY created_at DESC'),
  findById: db.prepare('SELECT * FROM documents WHERE id = ?'),
  findAll: db.prepare(`
    SELECT * FROM documents 
    WHERE user_id = ? OR is_public = 1 
    ORDER BY created_at DESC
  `),
  delete: db.prepare('DELETE FROM documents WHERE id = ?'),
  updatePublic: db.prepare('UPDATE documents SET is_public = ? WHERE id = ?'),
  getStats: db.prepare(`
    SELECT 
      COUNT(*) as total_documents,
      SUM(file_size) as total_size,
      SUM(chunks_count) as total_chunks
    FROM documents
    WHERE user_id = ?
  `)
};

// Document chunks queries
export const chunkQueries = {
  create: db.prepare(`
    INSERT INTO document_chunks (document_id, chunk_index, chunk_text, embedding, metadata)
    VALUES (?, ?, ?, ?, ?)
  `),
  findByDocumentId: db.prepare('SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index'),
  deleteByDocumentId: db.prepare('DELETE FROM document_chunks WHERE document_id = ?')
};

// Activity log queries
export const activityQueries = {
  log: db.prepare(`
    INSERT INTO activity_log (user_id, action, details, ip_address)
    VALUES (?, ?, ?, ?)
  `),
  getByUserId: db.prepare(`
    SELECT * FROM activity_log 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `),
  getRecent: db.prepare(`
    SELECT al.*, u.username, u.full_name
    FROM activity_log al
    JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT ?
  `)
};

// ==================== NEW: CONVERSATION HISTORY QUERIES ====================

export const conversationQueries = {
  // Get all conversations for a user with message count
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

  // Get single conversation
  getById: db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?'),

  // Get messages for a conversation
  getMessages: db.prepare(`
    SELECT * FROM messages 
    WHERE conversation_id = ? 
    ORDER BY created_at ASC
  `),

  // Create new conversation
  create: db.prepare(`
    INSERT INTO conversations (user_id, title) 
    VALUES (?, ?)
  `),

  // Add message to conversation
  addMessage: db.prepare(`
    INSERT INTO messages (conversation_id, role, content) 
    VALUES (?, ?, ?)
  `),

  // Update conversation title
  updateTitle: db.prepare(`
    UPDATE conversations 
    SET title = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND user_id = ?
  `),

  // Update conversation timestamp
  updateTimestamp: db.prepare(`
    UPDATE conversations 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `),

  // Delete conversation (cascade delete messages)
  delete: db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?'),

  // Search conversations
  search: db.prepare(`
    SELECT DISTINCT c.*,
      COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ? 
    AND (c.title LIKE ? OR m.content LIKE ?)
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT 50
  `)
};

// Cleanup expired sessions periodically
setInterval(() => {
  sessionQueries.deleteExpired.run();
}, 60 * 60 * 1000); // Every hour

export default db;