import { useState, useEffect } from 'react';
import { MessageSquare, FileText, Settings, Database, Users as UsersIcon, LogOut, Shield, History, TrendingUp } from 'lucide-react';
import Chat from './components/Chat';
import DocumentManager from './components/DocumentManager';
import SettingsPanel from './components/Settings';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import ConversationHistory from './components/ConversationHistory';
import { apiRequest } from './api/client';
import Predictions from './components/Predictions';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [documents, setDocuments] = useState([]);
  const [selectedModel, setSelectedModel] = useState('llama3.2:3b');
  const [vectorStore, setVectorStore] = useState(new Map());
  const [embeddings, setEmbeddings] = useState(new Map());
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  
  // Chat messages state for conversation history
  const [messages, setMessages] = useState([]);
  const [currentConversationTitle, setCurrentConversationTitle] = useState('');

  useEffect(() => {
    checkAuth();
    checkOllamaStatus();
  }, []);

  // Load shared documents for viewers automatically
  useEffect(() => {
    if (user && user.role === 'viewer') {
      loadSharedDocumentsForViewer();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await apiRequest('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkOllamaStatus = async () => {
    try {
      const response = await apiRequest('/api/ollama/status');
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus(data.status === 'connected' ? 'connected' : 'disconnected');
      } else {
        setOllamaStatus('disconnected');
      }
    } catch (error) {
      setOllamaStatus('disconnected');
    }
  };

  // Load shared documents for viewers
  const loadSharedDocumentsForViewer = async () => {
    try {
      console.log('🔍 Loading shared documents for viewer...');
      
      const response = await apiRequest('/api/documents');
      
      if (!response.ok) {
        console.error('Failed to load documents');
        return;
      }
      
      const data = await response.json();
      const docs = data.documents || [];
      
      console.log(`📚 Found ${docs.length} accessible documents`);
      
      if (docs.length === 0) {
        return;
      }
      
      // Load chunks for each document
      const docsWithChunks = await Promise.all(
        docs.map(async (doc) => {
          try {
            const chunksResponse = await apiRequest(`/api/documents/${doc.id}/chunks`);
            
            if (chunksResponse.ok) {
              const chunksData = await chunksResponse.json();
              const chunks = chunksData.chunks || [];
              
              console.log(`  ✅ ${doc.filename}: ${chunks.length} chunks`);
              
              return {
                name: doc.filename,
                id: doc.id,
                text: '',
                chunks: chunks.map(c => ({
                  text: c.chunk_text,
                  embedding: c.embedding ? (typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding) : [],
                  chunkId: c.chunk_index,
                  metadata: c.metadata ? (typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata) : {}
                })),
                metadata: {
                  ...doc.metadata,
                  type: doc.file_type,
                  size: doc.file_size,
                  isPDF: doc.file_type === 'pdf',
                  isExcel: ['xlsx', 'xls'].includes(doc.file_type),
                  isImage: ['jpg', 'jpeg', 'png', 'gif'].includes(doc.file_type)
                },
                shared: doc.shared || false,
                processedAt: doc.created_at
              };
            }
            return null;
          } catch (error) {
            console.error(`Failed to load chunks for ${doc.filename}:`, error);
            return null;
          }
        })
      );
      
      const validDocs = docsWithChunks.filter(d => d !== null && d.chunks.length > 0);
      console.log(`✅ Loaded ${validDocs.length} documents with chunks`);
      
      // Set documents state
      setDocuments(validDocs);
      
      // Build vector store and embeddings
      const newVectorStore = new Map();
      const newEmbeddings = new Map();
      
      validDocs.forEach(doc => {
        if (doc.chunks && doc.chunks.length > 0) {
          newVectorStore.set(doc.name, doc.chunks);
          
          // Extract embeddings
          const docEmbeddings = doc.chunks
            .map(chunk => chunk.embedding)
            .filter(emb => emb && emb.length > 0);
          
          if (docEmbeddings.length > 0) {
            newEmbeddings.set(doc.name, docEmbeddings);
          }
        }
      });
      
      console.log(`🗂️ Vector store built: ${newVectorStore.size} documents`);
      console.log(`🧠 Embeddings loaded: ${newEmbeddings.size} documents`);
      
      setVectorStore(newVectorStore);
      setEmbeddings(newEmbeddings);
      
    } catch (error) {
      console.error('❌ Failed to load shared documents:', error);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setActiveTab('chat');
      setDocuments([]);
      setVectorStore(new Map());
      setEmbeddings(new Map());
      setMessages([]);
      setCurrentConversationTitle('');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Handle loading a conversation from history
  const handleLoadConversation = (loadedMessages, title) => {
    setMessages(loadedMessages);
    setCurrentConversationTitle(title || '');
    setActiveTab('chat');
  };

  // Handle starting a new chat
  const handleNewChat = () => {
    if (messages.length > 0) {
      const shouldContinue = confirm('Starting a new chat will clear current messages. Continue?');
      if (!shouldContinue) return;
    }
    
    setMessages([]);
    setCurrentConversationTitle('');
    setActiveTab('chat');
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <Database size={48} className="spin" />
          <p>Loading LocalLLM Hub...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Define tabs based on user role
  const getTabs = () => {
    const baseTabs = [
      { id: 'chat', icon: MessageSquare, label: 'Chat', roles: ['admin', 'developer', 'viewer'] }
    ];

    // History tab for ALL ROLES
    baseTabs.push({ 
      id: 'history', 
      icon: History, 
      label: 'History', 
      roles: ['admin', 'developer', 'viewer']
    });

    // Documents tab only for admin and developer
    if (user.role === 'admin' || user.role === 'developer') {
      baseTabs.push({ 
        id: 'documents', 
        icon: FileText, 
        label: 'Documents', 
        roles: ['admin', 'developer'] 
      });
    }


    baseTabs.push({ 
      id: 'predictions', 
      icon: TrendingUp ,
      label: 'Predictions', 
      roles: ['admin', 'developer', 'viewer'] });


    // Settings for all
    baseTabs.push({ 
      id: 'settings', 
      icon: Settings, 
      label: 'Settings', 
      roles: ['admin', 'developer', 'viewer'] 
    });

    // User Management only for admin
    if (user.role === 'admin') {
      baseTabs.push({ 
        id: 'users', 
        icon: UsersIcon, 
        label: 'Users', 
        roles: ['admin'] 
      });
    }

    return baseTabs;
  };

  const tabs = getTabs();

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#ef4444';
      case 'developer': return '#60a5fa';
      case 'viewer': return '#10b981';
      default: return '#888';
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <Database size={32} />
          <h1>LocalLLM Hub</h1>
        </div>
        
        <div className="user-info-panel">
          <div className="user-avatar" style={{ background: getRoleColor(user.role) }}>
            {user.role === 'admin' ? <Shield size={20} /> : user.username.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <strong>{user.full_name || user.username}</strong>
            <span className={`user-role ${user.role}`}>{user.role}</span>
          </div>
        </div>

        <div className="status-indicator">
          <div className={`status-dot ${ollamaStatus}`}></div>
          <span>Ollama: {ollamaStatus}</span>
        </div>

        <nav className="sidebar-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="document-count">
            <FileText size={16} />
            <span>{documents.length} documents</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'chat' && (
          <Chat 
            documents={documents}
            selectedModel={selectedModel}
            vectorStore={vectorStore}
            embeddings={embeddings}
            user={user}
            messages={messages}
            setMessages={setMessages}
            conversationTitle={currentConversationTitle}
            onNewChat={handleNewChat}
          />
        )}
        
        {activeTab === 'history' && (
          <ConversationHistory 
            onLoadConversation={handleLoadConversation}
            currentMessages={messages}
            onNewChat={handleNewChat}
          />
        )}
        
        {activeTab === 'documents' && (user.role === 'admin' || user.role === 'developer') && (
          <DocumentManager
            documents={documents}
            setDocuments={setDocuments}
            vectorStore={vectorStore}
            setVectorStore={setVectorStore}
            embeddings={embeddings}
            setEmbeddings={setEmbeddings}
            user={user}
          />
        )}

        {activeTab === 'predictions' && (
          <Predictions 
            documents={documents} 
            user={user} />
        )}
        
        {activeTab === 'settings' && (
          <SettingsPanel
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            onRefreshStatus={checkOllamaStatus}
            user={user}
          />
        )}
        
        {activeTab === 'users' && user.role === 'admin' && (
          <UserManagement />
        )}
      </div>
    </div>
  );
}

export default App;