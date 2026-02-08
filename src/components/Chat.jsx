import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, FileText, Brain, Plus, Save } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './Chat.css';

function Chat({ documents, selectedModel, vectorStore, embeddings, user, messages, setMessages, conversationTitle, onNewChat }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usedSources, setUsedSources] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enhanced cosine similarity with normalization
  const cosineSimilarity = (vec1, vec2) => {
    if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) return 0;
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      const v1 = vec1[i] || 0;
      const v2 = vec2[i] || 0;
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    return dotProduct / (mag1 * mag2);
  };

  // Generate embedding for query using Ollama
  const generateQueryEmbedding = async (query) => {
    try {
      const response = await apiRequest('/api/ollama/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: query
        })
      });
      
      if (!response.ok) {
        return simpleWordEmbedding(query);
      }
      
      const data = await response.json();
      return data.embedding;
    } catch (error) {
      return simpleWordEmbedding(query);
    }
  };

  const simpleWordEmbedding = (text) => {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordFreq = {};
    
    words.forEach(word => {
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    
    return topWords.map(([word, freq]) => freq);
  };

  // NEW: Detect response length preference from user query
  const detectResponseLength = (query) => {
    const lowerQuery = query.toLowerCase();
    
    // Very brief indicators
    if (lowerQuery.match(/\b(in one line|one sentence|briefly|short answer|just tell me|simply|quick answer)\b/)) {
      return 'brief';
    }
    
    // Brief indicators
    if (lowerQuery.match(/\b(summarize|summary|quick|briefly|in short|tldr|concise)\b/)) {
      return 'concise';
    }
    
    // Detailed indicators
    if (lowerQuery.match(/\b(explain|detailed|elaborate|in detail|comprehensive|all|everything)\b/)) {
      return 'detailed';
    }
    
    // List indicators
    if (lowerQuery.match(/\b(list|enumerate|what are|show me all|give me all)\b/)) {
      return 'list';
    }
    
    // Default to balanced
    return 'balanced';
  };

  // Build conversation context from history
  const buildConversationContext = () => {
    if (messages.length === 0) return '';
    
    // Get last 6 messages (3 exchanges) for context
    const recentMessages = messages.slice(-6);
    
    const conversationHistory = recentMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    
    return `

### CONVERSATION HISTORY:
${conversationHistory}

`;
  };

  // Advanced context retrieval with SERVER-SIDE semantic search
  const findRelevantContext = async (query) => {
    try {
      // Get all document IDs
      const allDocIds = documents.map(doc => doc.id);
      
      if (allDocIds.length === 0) {
        console.log('[Chat] No documents available for RAG');
        return { context: '', sources: [] };
      }
      
      console.log('[Chat] ========== CALLING SERVER RAG ==========');
      console.log('[Chat] Query:', query);
      console.log('[Chat] Documents:', allDocIds.length);
      
      // Call server-side RAG endpoint
      const response = await apiRequest('/api/chat/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          documentIds: allDocIds,
          maxChunks: 5
        })
      });
      
      if (!response.ok) {
        console.error('[Chat] ❌ RAG endpoint failed:', response.status);
        return { context: '', sources: [] };
      }
      
      const ragData = await response.json();
      
      console.log('[Chat] RAG response received:');
      console.log('  - RAG used:', ragData.ragUsed);
      console.log('  - Chunks found:', ragData.relevantChunks?.length);
      console.log('  - Context length:', ragData.context?.length);
      console.log('  - Documents:', ragData.documentNames);
      
      if (!ragData.ragUsed || !ragData.context) {
        console.log('[Chat] ⚠️ No RAG context generated');
        return { context: '', sources: [] };
      }
      
      // Format context for Ollama
      const context = '\n\n### RELEVANT INFORMATION FROM DOCUMENTS:\n\n' + ragData.context;
      
      // Format sources for UI
      const sources = (ragData.relevantChunks || []).map((chunk, i) => ({
        doc: ragData.documentNames?.[0] || 'Document',
        score: chunk.score?.toFixed(3) || '0.000',
        preview: chunk.text || ''
      }));
      
      console.log('[Chat] ✅ Context prepared:', context.length, 'chars');
      console.log('[Chat] ========================================\n');
      
      return { context, sources };
      
    } catch (error) {
      console.error('[Chat] ❌ RAG error:', error);
      return { context: '', sources: [] };
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    const currentQuery = input; // Save before clearing
    setInput('');
    setIsLoading(true);
    // setUsedSources([]);

    try {
      const { context, sources } = await findRelevantContext(currentQuery);
      // setUsedSources(sources);
      
      // Detect desired response length
      const responseLength = detectResponseLength(currentQuery);
      
      const conversationContext = buildConversationContext();
      
      // ENHANCED: Response length specific instructions
      const lengthInstructions = {
        brief: `
CRITICAL: The user wants a VERY BRIEF answer (ONE LINE/ONE SENTENCE).
- Answer in ONE sentence maximum
- Be direct and concise
- No explanations or elaborations
- Just state the key fact or answer
- Example: "The budget is $127,500" NOT "According to the document, the project budget is set at $127,500 which includes..."`,
        
        concise: `
IMPORTANT: The user wants a CONCISE answer.
- Keep response to 2-3 sentences maximum
- Focus on the most important information only
- Skip background details unless critical
- Be direct and to the point`,
        
        balanced: `
Provide a balanced, focused answer:
- 1-2 paragraphs maximum
- Include key facts and relevant details
- Don't over-explain unless asked
- Be clear and direct`,
        
        detailed: `
Provide a comprehensive, detailed answer:
- Include all relevant information
- Provide context and background
- Explain thoroughly
- Include examples if helpful`,
        
        list: `
Provide answer as a LIST:
- Use bullet points or numbered list
- Each item should be concise
- Include all relevant items
- No long explanations per item unless asked`
      };

      // ENHANCED: Strict system prompt with length awareness
      const systemPrompt = `You are a precise AI assistant with access to user documents and conversation history.

CRITICAL RESPONSE LENGTH INSTRUCTIONS:
${lengthInstructions[responseLength]}

ABSOLUTE RULES:
1. FOLLOW THE LENGTH INSTRUCTION EXACTLY - This is the most important rule
2. If user says "in one line" or "briefly" - give ONLY one sentence, nothing more
3. If user says "summarize" - give 2-3 sentences max
4. If user says "list" - use bullet points only
5. Match the user's requested style and length PRECISELY

CONVERSATION CONTINUITY:
- Remember conversation history provided below
- Use context from previous messages for pronouns and references
- For follow-up questions, be even MORE concise since context is established

DOCUMENT USAGE:
- Use documents as primary source when available
- Cite sources briefly: "Source 1 states..." or just state the fact directly
- For brief answers, skip citations unless specifically asked

EXAMPLES OF CORRECT RESPONSES:

User: "What is the budget in one line?"
CORRECT: "The project budget is $127,500."
WRONG: "According to the project planning document (Source 1), the allocated budget for this project is $127,500, which covers development, testing, and deployment phases."

User: "Briefly, what are the main risks?"
CORRECT: "The main risks are technical debt (high), timeline delays (medium), and API dependencies (low)."
WRONG: "Based on the risk assessment document, I can identify several key risks. The primary concern is technical debt accumulation, which has been rated as high priority due to the aggressive timeline. Additionally, there are concerns about..."

User: "List the features"
CORRECT:
- User authentication
- Dashboard analytics
- Report generation
WRONG: "The document outlines several features. First, there's user authentication which is important for security. Then we have dashboard analytics for data visualization..."

Remember: BE CONCISE. Match the user's requested length EXACTLY. Don't over-explain.`;

      // ENHANCED: Concise prompt construction
      let prompt;
      if (context || messages.length > 0) {
        // Build focused prompt based on response length
        let querySection = `CURRENT USER QUESTION: ${currentQuery}`;
        
        // For brief responses, emphasize the instruction
        if (responseLength === 'brief') {
          querySection = `CURRENT USER QUESTION (WANTS ONE LINE ANSWER): ${currentQuery}`;
        }
        
        prompt = `${conversationContext}

${querySection}

${context || '(No specific document context found)'}

INSTRUCTIONS:
1. ${lengthInstructions[responseLength]}
2. Consider conversation history for context
3. Use document information when available
4. Answer EXACTLY as requested - no more, no less

YOUR ANSWER:`;
      } else {
        prompt = `USER QUESTION: ${currentQuery}

${lengthInstructions[responseLength]}

YOUR ANSWER:`;
      }

      const response = await apiRequest('/api/ollama/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: prompt,
          system: systemPrompt,
          stream: true,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            top_k: 40,
            num_ctx: 4096,
            num_predict: responseLength === 'brief' ? 50 : (responseLength === 'concise' ? 300 : 2048),
            repeat_penalty: 1.3,
            stop: ['\n\nUSER:', '\n\nHuman:', '\n\nQuestion:', 'USER:', 'Human:', 'Question:']
          }
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: 'assistant', content: '', sources: sources.length > 0 };
      
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              assistantMessage.content += json.response;
              setMessages(prev => [
                ...prev.slice(0, -1),
                { ...assistantMessage }
              ]);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error('💥 Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSaveConversation = async () => {
    if (!saveTitle.trim()) {
      alert('Please enter a title for this conversation');
      return;
    }

    if (messages.length === 0) {
      alert('No messages to save');
      return;
    }

    try {
      const response = await apiRequest('/api/conversations/save-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveTitle,
          messages: messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save conversation');
      }

      setShowSaveDialog(false);
      setSaveTitle('');
      alert('Conversation saved successfully!');
    } catch (error) {
      console.error('Error saving conversation:', error);
      alert('Failed to save conversation: ' + error.message);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-left">
          <h2>
            {conversationTitle || `Chat with ${selectedModel}`}
          </h2>
          {documents.length > 0 && (
            <div className="context-info">
              <Brain size={14} />
              <span>
                {documents.length} docs
                {documents.filter(d => d.shared).length > 0 && 
                  ` • ${documents.filter(d => d.shared).length} shared`}
                {' • Smart RAG active'}
              </span>
            </div>
          )}
        </div>

        <div className="header-actions">
          {messages.length > 0 && (
            <>
              <button 
                onClick={() => setShowSaveDialog(true)}
                className="action-btn save-btn"
                title="Save conversation"
              >
                <Save size={16} />
                <span>Save</span>
              </button>
              
              {onNewChat && (
                <button 
                  onClick={onNewChat}
                  className="action-btn new-chat-btn"
                  title="Start new chat"
                >
                  <Plus size={16} />
                  <span>New Chat</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showSaveDialog && (
        <div className="save-dialog-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Save Conversation</h3>
            <p>Enter a title for this conversation:</p>
            <input
              type="text"
              placeholder="e.g., Discussion about project requirements"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveConversation();
                }
              }}
            />
            <div className="dialog-actions">
              <button onClick={handleSaveConversation} className="save-dialog-btn">
                <Save size={16} />
                Save
              </button>
              <button 
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveTitle('');
                }}
                className="cancel-dialog-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <Bot size={48} />
            <h3>Start a conversation</h3>
            <p>Ask questions naturally - specify "briefly" or "in detail" as needed</p>
            {documents.length > 0 && (
              <div className="suggestions">
                <p>Try different question styles:</p>
                <button onClick={() => setInput("Briefly, what are the main topics?")}>
                  "Briefly, what are the main topics?"
                </button>
                <button onClick={() => setInput("List the key findings in one line each")}>
                  "List the key findings"
                </button>
                <button onClick={() => setInput("Explain the methodology in detail")}>
                  "Explain in detail"
                </button>
              </div>
            )}
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-icon">
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className="message-content">
              {msg.content}
              {/* {msg.sources && usedSources.length > 0 && idx === messages.length - 1 && (
                <div className="sources">
                  <div className="sources-header">
                    <FileText size={14} />
                    <span>Sources:</span>
                  </div>
                  {usedSources.map((source, i) => (
                    <div key={i} className="source-item">
                      <span className="source-name">{source.doc}</span>
                      <span className="source-score">
                        {(parseFloat(source.score) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )} */}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message assistant loading">
            <div className="message-icon">
              <Loader2 size={20} className="spin" />
            </div>
            <div className="message-content">
              Thinking...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={messages.length > 0 
            ? "Ask follow-up questions (add 'briefly' or 'in detail' to control length)..." 
            : (documents.length > 0 
              ? "Ask about your documents (try 'briefly' or 'list' for different formats)..." 
              : "Ask a question...")}
          rows={3}
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="send-button"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

export default Chat;