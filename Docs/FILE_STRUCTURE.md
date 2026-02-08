# Complete File Structure for LocalLLM Hub Web

## 📁 Required Directory Structure

```
localllm-hub-web/
├── package.json                          ← From artifact: "package.json (Web Version)"
├── vite.config.js                        ← From artifact: "vite.config.js (Web Version)"
├── index.html                            ← From artifact: "index.html (Web Version)"
├── .env                                  ← Copy from .env.example
├── .env.example                          ← From artifact: ".env.example"
├── .gitignore                            ← Create new
├── README.md                             ← From artifact: "README.md (Web Version)"
├── WEB_DEPLOYMENT_GUIDE.md              ← From artifact
├── MIGRATION_GUIDE.md                    ← From artifact
├── server/
│   └── index.js                          ← From artifact: "server/index.js"
└── src/
    ├── main.jsx                          ← COPY from your desktop app (unchanged)
    ├── App.jsx                           ← From artifact: updated version
    ├── App.css                           ← COPY from your desktop app (unchanged)
    └── components/
        ├── Chat.jsx                      ← From artifact: "Chat.jsx (Advanced)" with web updates
        ├── Chat.css                      ← COPY from your desktop app (unchanged)
        ├── DocumentManager.jsx           ← From artifact: "DocumentManager.jsx (Web)"
        ├── DocumentManager.css           ← COPY from your desktop app (unchanged)
        ├── Settings.jsx                  ← From artifact: updated version
        └── Settings.css                  ← COPY from your desktop app (unchanged)
```

## ✅ Checklist

Copy these files **AS-IS** from your desktop app (no changes needed):

- [ ] `src/main.jsx`
- [ ] `src/App.css`
- [ ] `src/components/Chat.css`
- [ ] `src/components/DocumentManager.css`
- [ ] `src/components/Settings.css`

Create these NEW files from artifacts:

- [ ] `package.json` - Web version with Express dependencies
- [ ] `vite.config.js` - Web version with proxy config
- [ ] `index.html` - Web version
- [ ] `server/index.js` - Express backend server
- [ ] `.env.example` - Environment template
- [ ] `src/components/DocumentManager.jsx` - Web version (no Electron)
- [ ] Updated `src/App.jsx` - Web API calls
- [ ] Updated `src/components/Chat.jsx` - Web API calls
- [ ] Updated `src/components/Settings.jsx` - Web API calls

## 🔍 How to Identify Which Version

### package.json
**Web version has:**
```json
"dependencies": {
  "express": "^4.18.2",     ← Must have Express
  "cors": "^2.8.5",         ← Must have CORS
  ...
}
```

**Desktop version has:**
```json
"dependencies": {
  "electron": "^28.0.0",    ← Has Electron (wrong for web!)
  ...
}
```

### DocumentManager.jsx
**Web version:**
```javascript
// Uses browser file input
const input = document.createElement('input');
input.type = 'file';
```

**Desktop version:**
```javascript
// Uses Electron API
if (window.electron && window.electron.selectFiles) {
  const electronFiles = await window.electron.selectFiles();
```

### Chat.jsx & Settings.jsx
**Web version:**
```javascript
// API calls through backend
fetch('/api/ollama/generate', ...)
```

**Desktop version:**
```javascript
// Direct Ollama calls
fetch('http://localhost:11434/api/generate', ...)
```

## 📝 .gitignore Contents

Create this file:

```
node_modules/
dist/
.env
.DS_Store
*.log
.vite/
tmp/
```

## ⚙️ .env Contents

Create from .env.example:

```bash
PORT=3001
NODE_ENV=development
OLLAMA_URL=http://localhost:11434
```

## 🚀 After All Files Are in Place

```bash
# Install dependencies
npm install

# Should install these packages:
# - express, cors, multer (backend)
# - react, vite (frontend)
# - pdfjs-dist, tesseract.js, xlsx (processing)

# Start development
npm run dev

# You should see:
# [0] Server running on http://localhost:3001
# [1] Vite dev server on http://localhost:5173
```

## 🐛 Common Issues

### Issue: "Cannot find module 'express'"
**Problem:** Wrong package.json (using desktop version)
**Solution:** Use package.json from artifact "package.json (Web Version)"

### Issue: "window.electron is not defined"
**Problem:** Using desktop DocumentManager.jsx
**Solution:** Use DocumentManager.jsx from artifact "DocumentManager.jsx (Web)"

### Issue: "CORS error"
**Problem:** Direct Ollama calls instead of proxy
**Solution:** Update Chat.jsx and Settings.jsx to use `/api/ollama/*`

### Issue: Port 5173 shows 404
**Problem:** Missing index.html or src files
**Solution:** Ensure index.html and src/main.jsx exist

### Issue: Port 3001 shows "Cannot GET /"
**Problem:** That's expected! Port 3001 is API only
**Solution:** Use port 5173 (http://localhost:5173)

## 📦 Verification Steps

After setup, verify:

1. **File count:**
   ```bash
   find . -type f -name "*.jsx" | wc -l
   # Should show: 4 files (main.jsx, App.jsx, Chat.jsx, DocumentManager.jsx, Settings.jsx)
   
   find . -type f -name "*.css" | wc -l
   # Should show: 4 files (App.css, Chat.css, DocumentManager.css, Settings.css)
   ```

2. **Dependencies installed:**
   ```bash
   ls node_modules | grep express
   # Should show: express
   
   ls node_modules | grep -E "(react|vite)"
   # Should show: react, react-dom, vite
   ```

3. **Server file exists:**
   ```bash
   cat server/index.js | grep "express"
   # Should show Express imports
   ```

4. **No Electron references:**
   ```bash
   grep -r "electron" src/
   # Should show: NO RESULTS (or only in comments)
   ```

If all checks pass, you're ready to run!

```bash
npm run dev
```

Then open: http://localhost:5173
