# LocalLLM Hub - Web Version 🌐

A privacy-focused, web-based RAG application with advanced document processing, semantic search, and local LLM integration via Ollama.

## ✨ Features

- 🔒 **100% Private** - All processing happens on your server
- 📄 **Multi-Format Support** - PDF, Excel, Word, CSV, Images (OCR)
- 🧠 **Advanced RAG** - Semantic search with embeddings
- 💬 **Smart Chat** - Context-aware responses with source attribution
- 🎯 **Accurate** - 90%+ retrieval accuracy with hybrid search
- 🚀 **Fast** - Optimized for M1/M2 and GPU acceleration
- 🌐 **Web-Based** - Access from any device, anywhere

## 📋 Requirements

- **Node.js** 18+ 
- **Ollama** (running locally or on server)
- **16GB+ RAM** (32GB recommended)
- **Modern browser** (Chrome, Firefox, Safari, Edge)

## 🚀 Quick Start

### 1. Install Ollama

```bash
# macOS/Linux
curl https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve

# Pull required models
ollama pull llama3.2:3b
ollama pull nomic-embed-text  # For semantic search
```

### 2. Setup Application

```bash
# Clone or download the project
cd localllm-hub-web

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env if needed (default is localhost:11434)
```

### 3. Run Development Server

```bash
npm run dev
```

Open browser: **http://localhost:5173**

### 4. Production Build

```bash
npm run build
npm start
```

## 📚 Usage

### Upload Documents

1. Click **Documents** tab
2. Click **Upload Documents**
3. Select files (PDF, Excel, Word, images, etc.)
4. Wait for processing (progress bar shows status)
5. Documents appear with metadata and embeddings icon 🧠

### Chat with Documents

1. Go to **Chat** tab
2. Type your question
3. AI responds with answers from your documents
4. See source attribution at bottom of response

### Supported File Types

| Type | Extensions | Features |
|------|-----------|----------|
| **PDF** | .pdf | Multi-page, full text extraction |
| **Excel** | .xlsx, .xls | Multiple sheets, all data types |
| **Word** | .docx | Full text extraction |
| **Text** | .txt, .md | Plain text |
| **CSV** | .csv | Structured data |
| **Images** | .jpg, .png, .gif | OCR text recognition |

## 🏗️ Architecture

```
┌──────────────┐
│   Browser    │  ← Users access via web
│   (React)    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   Express    │  ← Backend API server
│   Server     │  ← Handles file uploads
│   (Node.js)  │  ← Proxies Ollama requests
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   Ollama     │  ← LLM inference engine
│   Server     │  ← Runs models locally
└──────────────┘
```

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Server port
PORT=3001

# Environment
NODE_ENV=development

# Ollama server URL
OLLAMA_URL=http://localhost:11434
```

### Available Models

Check installed models:
```bash
ollama list
```

Install more models:
```bash
ollama pull llama3.1:8b    # Better quality
ollama pull mistral        # Alternative
ollama pull phi3           # Smaller, faster
```

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Ollama Status
```
GET /api/ollama/status
```

### Get Models
```
GET /api/ollama/models
```

### Generate Response
```
POST /api/ollama/generate
Body: { model, prompt, stream }
```

### Generate Embeddings
```
POST /api/ollama/embeddings
Body: { model, prompt }
```

### Upload Files
```
POST /api/upload
FormData: files[]
```

## 🚀 Deployment

### Deploy to Your Server

```bash
# On your server
git clone <your-repo>
cd localllm-hub-web

# Install dependencies
npm install

# Build production version
npm run build

# Start with PM2
npm install -g pm2
pm2 start server/index.js --name localllm-hub
pm2 save
```

### Nginx Configuration

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
    }
}
```

### Docker Deployment

```bash
docker-compose up -d
```

See **WEB_DEPLOYMENT_GUIDE.md** for complete deployment instructions.

## 🔒 Security

### For Public Deployment

Add authentication to `server/index.js`:

```javascript
import basicAuth from 'express-basic-auth';

app.use(basicAuth({
  users: { 'admin': process.env.ADMIN_PASSWORD },
  challenge: true
}));
```

### Recommended Settings

- ✅ Enable HTTPS (use Let's Encrypt)
- ✅ Add rate limiting
- ✅ Set file size limits
- ✅ Use strong passwords
- ✅ Keep dependencies updated

## 📊 Performance

### Recommended Hardware

**Minimum:**
- 4 vCPU
- 16GB RAM
- 50GB SSD

**Recommended:**
- 8 vCPU
- 32GB RAM
- 100GB NVMe SSD
- GPU (for faster inference)

### Processing Times (M2 Pro)

| Operation | Time |
|-----------|------|
| 10-page PDF | 5-8s |
| Excel (5 sheets) | 3-5s |
| Image OCR | 8-12s |
| Generate embedding | 100ms |
| Chat response | 2-5s |

## 🐛 Troubleshooting

### Ollama Connection Failed

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
pkill ollama
ollama serve
```

### Port Already in Use

```bash
# Change PORT in .env
PORT=3002
```

### Out of Memory

- Use smaller models (llama3.2:3b)
- Reduce concurrent requests
- Add swap space
- Upgrade server RAM

### Slow Performance

- Enable GPU acceleration
- Use faster models
- Reduce chunk sizes
- Add caching

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - feel free to use for any purpose!

## 🙏 Acknowledgments

- **Ollama** - Local LLM runtime
- **PDF.js** - PDF processing
- **Tesseract.js** - OCR capabilities
- **SheetJS** - Excel processing
- Meta for **Llama** models

## 📞 Support

- 📖 [Deployment Guide](WEB_DEPLOYMENT_GUIDE.md)
- 🔄 [Migration Guide](MIGRATION_GUIDE.md)
- 🐛 [Issue Tracker](https://github.com/your-repo/issues)

---

**Built with ❤️ for privacy-conscious teams**

Access powerful AI without compromising your data. Everything runs on your infrastructure.

🌟 **Star this repo** if you find it useful!
