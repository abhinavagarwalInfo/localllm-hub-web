import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Clock, 
  Trash2, 
  Search, 
  Plus, 
  Edit2, 
  Check, 
  X,
  Download,
  Upload
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import './ConversationHistory.css';

function ConversationHistory({ onLoadConversation, currentMessages, onNewChat }) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest('/api/conversations');
      
      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }
      
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadConversation = async (conversationId) => {
    try {
      const response = await apiRequest(`/api/conversations/${conversationId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }
      
      const data = await response.json();
      
      // Convert messages to chat format
      const messages = data.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      onLoadConversation(messages, data.conversation.title);
    } catch (err) {
      console.error('Error loading conversation:', err);
      alert('Failed to load conversation: ' + err.message);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    try {
      const response = await apiRequest(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }
      
      // Reload conversations
      await loadConversations();
    } catch (err) {
      console.error('Error deleting conversation:', err);
      alert('Failed to delete conversation: ' + err.message);
    }
  };

  const handleStartEdit = (conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const handleSaveEdit = async (conversationId) => {
    try {
      const response = await apiRequest(`/api/conversations/${conversationId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: editTitle })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }
      
      setEditingId(null);
      await loadConversations();
    } catch (err) {
      console.error('Error updating conversation:', err);
      alert('Failed to update conversation: ' + err.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleSaveCurrentChat = async () => {
    if (!saveTitle.trim()) {
      alert('Please enter a title for this conversation');
      return;
    }
    
    if (!currentMessages || currentMessages.length === 0) {
      alert('No messages to save');
      return;
    }
    
    try {
      const response = await apiRequest('/api/conversations/save-bulk', {
        method: 'POST',
        body: JSON.stringify({
          title: saveTitle,
          messages: currentMessages
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save conversation');
      }
      
      setShowSaveDialog(false);
      setSaveTitle('');
      await loadConversations();
      alert('Conversation saved successfully!');
    } catch (err) {
      console.error('Error saving conversation:', err);
      alert('Failed to save conversation: ' + err.message);
    }
  };

  const handleExportConversation = async (conversationId) => {
    try {
      const response = await apiRequest(`/api/conversations/${conversationId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }
      
      const data = await response.json();
      
      // Create export format
      const exportData = {
        title: data.conversation.title,
        created_at: data.conversation.created_at,
        messages: data.messages
      };
      
      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${conversationId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting conversation:', err);
      alert('Failed to export conversation: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="conversation-history">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-history">
      {/* Header */}
      <div className="history-header">
        <div className="header-top">
          <h2>
            <MessageSquare size={24} />
            Chat History
          </h2>
          <button 
            className="new-chat-btn"
            onClick={onNewChat}
            title="New Chat"
          >
            <Plus size={20} />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Save Current Chat Button */}
        {currentMessages && currentMessages.length > 0 && (
          <button 
            className="save-current-btn"
            onClick={() => setShowSaveDialog(true)}
          >
            <Upload size={18} />
            Save Current Chat
          </button>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="save-dialog">
          <h3>Save Current Conversation</h3>
          <input
            type="text"
            placeholder="Enter conversation title..."
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            autoFocus
          />
          <div className="dialog-actions">
            <button onClick={handleSaveCurrentChat} className="save-btn">
              <Check size={16} />
              Save
            </button>
            <button 
              onClick={() => {
                setShowSaveDialog(false);
                setSaveTitle('');
              }}
              className="cancel-btn"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
          <button onClick={loadConversations}>Try Again</button>
        </div>
      )}

      {/* Conversations List */}
      <div className="conversations-list">
        {filteredConversations.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} />
            <h3>No conversations yet</h3>
            <p>Your saved chats will appear here</p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div key={conv.id} className="conversation-item">
              {editingId === conv.id ? (
                <div className="edit-mode">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button 
                      onClick={() => handleSaveEdit(conv.id)}
                      className="save-btn"
                      title="Save"
                    >
                      <Check size={16} />
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      className="cancel-btn"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div 
                    className="conversation-content"
                    onClick={() => handleLoadConversation(conv.id)}
                  >
                    <h4>{conv.title}</h4>
                    <div className="conversation-meta">
                      <span className="message-count">
                        {conv.message_count || 0} messages
                      </span>
                      <span className="timestamp">
                        <Clock size={12} />
                        {formatDate(conv.updated_at || conv.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="conversation-actions">
                    <button
                      onClick={() => handleStartEdit(conv)}
                      title="Rename"
                      className="action-btn"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleExportConversation(conv.id)}
                      title="Export"
                      className="action-btn"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteConversation(conv.id)}
                      title="Delete"
                      className="action-btn delete-btn"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConversationHistory;