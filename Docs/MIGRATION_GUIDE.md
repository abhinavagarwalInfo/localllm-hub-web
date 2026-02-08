# Migration Guide: Desktop → Web

Quick guide to convert your Electron desktop app to a web application.

## 📁 File Changes Summary

### New Files to Create

```
server/
  └── index.js          # NEW - Express backend server

.env                    # NEW - Environment configuration
.env.example           # NEW - Example environment file
```

### Files to Replace

```
package.json           # Replace with web version
vite.config.js        # Replace with web version (includes proxy)

src/components/
  ├── Chat.jsx         # Update API calls to use /api/ollama/*
  ├── DocumentManager.jsx  # Remove Electron dependencies
  └── Settings.jsx     # Update to use /api/ollama/*

src/App.jsx           # Update Ollama status check
```

### Files to Delete

```
electron/
  ├── main.js          # DELETE - No longer needed
  └── preload.js       # DELETE - No longer needed
```

## 🔄 Step-by-Step Migration

### Step 1: Create New Project Folder

```bash
# Create new folder for web version
mkdir localllm-hub-web
cd localllm-hub-web
```

### Step 2: Copy Common Files

Copy these files from your desktop app (unchanged):

```bash
# From old project to new:
cp -r src/components/*.css localllm-hub-web/src/components/
cp src/App.css localllm-hub-web/src/
cp src/main.jsx localllm-hub-web/src/
cp index.html localllm-hub-web/
```

### Step 3: Add New Files

Use the artifacts I provided to create:

1. **package.json** (Web Version)
2. **server/index.js** (Express Backend)
3. **vite.config.js** (Web Version with proxy)
4. **.env.example**
5. **src/components/DocumentManager.jsx** (Web Version)
6. **src/components/Chat.jsx** (Updated API calls)
7. **src/components/Settings.jsx** (Updated API calls)
8. **src/App.jsx** (Updated Ollama check)

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Setup Environment

```bash
cp .env.example .env
```

Edit `.env` if Ollama is on a different server.

### Step 6: Test Locally

```bash
# Start both backend and frontend
npm run dev
```

Open: http://localhost:5173

### Step 7: Build for Production

```bash
npm run build
```

## 🔑 Key Differences

### Desktop App (Electron)
```javascript
// Direct access to Ollama
fetch('http://localhost:11434/api/generate')

// File system access via electron
window.electron.selectFiles()
```

### Web App (Browser + Express)
```javascript
// Proxied through backend
fetch('/api/ollama/generate')

// Browser file picker
<input type="file" />
```

## ⚠️ Important Changes

### 1. File Uploads

**Desktop:**
```javascript
// Electron provides files with base64 content
const files = await window.electron.selectFiles();
```

**Web:**
```javascript
// Browser provides File objects
const input = document.createElement('input');
input.type = 'file';
input.onchange = (e) => {
  const files = Array.from(e.target.files);
};
```

### 2. Ollama Communication

**Desktop:**
```javascript
// Direct connection
fetch('http://localhost:11434/api/generate')
```

**Web:**
```javascript
// Via backend proxy (avoids CORS)
fetch('/api/ollama/generate')
```

### 3. No More Window Controls

Remove Electron-specific code:
- `titleBarStyle`
- `window.electron.*` calls
- `ipcRenderer` communication

## 📊 Feature Comparison

| Feature | Desktop | Web | Notes |
|---------|---------|-----|-------|
| PDF Processing | ✅ | ✅ | Same (pdfjs-dist) |
| Excel Support | ✅ | ✅ | Same (xlsx) |
| OCR | ✅ | ✅ | Same (tesseract.js) |
| File Upload | Native Dialog | Browser Picker | Different UX |
| Ollama Access | Direct | Proxied | Need backend |
| Installation | Download .app | URL | Easier for web |
| Updates | Manual | Instant | Better for web |
| Offline | ✅ | ❌ | Desktop only |
| Multi-user | ❌ | ✅ | Web only |

## 🎯 Testing Checklist

After migration, test:

- [ ] Home page loads
- [ ] Ollama status shows "connected"
- [ ] Can upload TXT file
- [ ] Can upload PDF file
- [ ] Can upload Excel file
- [ ] Can upload image (OCR works)
- [ ] Chat responds correctly
- [ ] Document context works
- [ ] Embeddings generate
- [ ] Source attribution displays
- [ ] Can delete documents
- [ ] Settings show models
- [ ] Can switch models

## 🐛 Common Issues

### Issue: "Cannot find module 'express'"

```bash
npm install
```

### Issue: Ollama status "disconnected"

Check:
1. Ollama is running: `ollama serve`
2. Backend is running: `npm run server`
3. Environment variable: `OLLAMA_URL` in `.env`

### Issue: File upload fails

Check browser console for errors. Ensure:
- File size < 50MB
- File type is supported
- Tesseract/PDF.js loaded correctly

### Issue: CORS errors

Make sure requests go through `/api/ollama/*` not directly to Ollama.

## 📦 What You Keep

✅ **Same functionality:**
- All file processing (PDF, Excel, images)
- RAG with embeddings
- Semantic search
- Chat interface
- Multiple models

✅ **Same libraries:**
- React
- PDF.js
- Tesseract.js
- XLSX
- Mammoth

## 🚀 What You Gain

✅ **Better:**
- No installation required
- Access from any device
- Easy updates (just refresh)
- Share with team
- Mobile friendly
- Deploy to cloud

## 💾 Data Migration

Desktop app data (documents, embeddings) is stored in memory only.

For web version:
- Same (stored in browser memory)
- Lost on page refresh
- Consider adding persistence:
  - LocalStorage (client-side)
  - Database (server-side)
  - S3/Cloud storage

## 🔜 Future Enhancements

After migration, consider adding:

1. **User Authentication**
   - Login system
   - Personal document libraries

2. **Persistent Storage**
   - Save documents to database
   - Save chat history

3. **Multi-user Support**
   - Shared documents
   - Private workspaces

4. **API Access**
   - REST API for integrations
   - Webhook support

---

**Migration complete!** Your desktop app is now a web application. 🎉