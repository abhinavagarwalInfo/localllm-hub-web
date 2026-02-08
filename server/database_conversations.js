// database.js - Add to your existing database.js file

// Add these new tables to your database initialization

const conversationQueries = {
  // Create conversations table
  createTable: `
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  // Create messages table
  createMessagesTable: `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `,

  // Create indexes for better performance
  createIndexes: `
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
  `,

  // Get all conversations for a user
  getByUserId: `
    SELECT 
      c.*,
      COUNT(m.id) as message_count,
      MAX(m.created_at) as last_message_at
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `,

  // Get single conversation with messages
  getById: `
    SELECT * FROM conversations WHERE id = ? AND user_id = ?
  `,

  // Get messages for a conversation
  getMessages: `
    SELECT * FROM messages 
    WHERE conversation_id = ? 
    ORDER BY created_at ASC
  `,

  // Create new conversation
  create: `
    INSERT INTO conversations (user_id, title) 
    VALUES (?, ?)
  `,

  // Add message to conversation
  addMessage: `
    INSERT INTO messages (conversation_id, role, content) 
    VALUES (?, ?, ?)
  `,

  // Update conversation title
  updateTitle: `
    UPDATE conversations 
    SET title = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND user_id = ?
  `,

  // Update conversation timestamp
  updateTimestamp: `
    UPDATE conversations 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `,

  // Delete conversation
  delete: `
    DELETE FROM conversations WHERE id = ? AND user_id = ?
  `,

  // Search conversations
  search: `
    SELECT DISTINCT c.*
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = ? 
    AND (c.title LIKE ? OR m.content LIKE ?)
    ORDER BY c.updated_at DESC
    LIMIT 50
  `
};

// Initialize the new tables
function initializeConversationTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(conversationQueries.createTable, (err) => {
        if (err) {
          console.error('Error creating conversations table:', err);
          return reject(err);
        }
      });

      db.run(conversationQueries.createMessagesTable, (err) => {
        if (err) {
          console.error('Error creating messages table:', err);
          return reject(err);
        }
      });

      db.run(conversationQueries.createIndexes, (err) => {
        if (err) {
          console.error('Error creating indexes:', err);
          return reject(err);
        }
        console.log('✅ Conversation history tables initialized');
        resolve();
      });
    });
  });
}

// Export the queries and initialization function
module.exports = {
  conversationQueries,
  initializeConversationTables
};
