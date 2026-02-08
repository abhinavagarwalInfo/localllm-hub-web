# Complete Setup Checklist

## ✅ Step 1: Create All Files

Create a folder `localllm-hub-web` and add these files:

### Root Files

- [ ] `package.json` - From artifact "package.json (Web Version)"
- [ ] `vite.config.js` - From artifact "vite.config.js (Web Version)"  
- [ ] `index.html` - From artifact "index.html (Web Version)"
- [ ] `.env` - Copy from `.env.example` below

**.env file:**
```bash
PORT=3001
NODE_ENV=development
OLLAMA_URL=http://localhost:11434
```

### Server Folder: `server/`

- [ ] `server/index.js` - From artifact "server/index.js"

### Source Folder: `src/`

- [ ] `src/main.jsx` - From artifact "src/main.jsx"
- [ ] `src/App.jsx` - From artifact (updated version with web API calls)
- [ ] `src/App.css` - From artifact "src/App.css"

### Components Folder: `src/components/`

- [ ] `src/components/Chat.jsx` - From artifact "Chat.jsx (Advanced)" with web updates
- [ ] `src/components/Chat.css` - From artifact "src/components/Chat.css"
- [ ] `src/components/DocumentManager.jsx` - From artifact "DocumentManager.jsx (Web)"
- [ ] `src/components/DocumentManager.css` - From artifact "src/components/DocumentManager.css"
- [ ] `src/components/Settings.jsx` - From artifact (updated version)
- [ ] `src/components/Settings.css` - From artifact "src/components/Settings.css"

## ✅ Step 2: Verify File Structure

Run this command:

```bash
ls -R
```

You should see:
```
.:
index.html  package.json  server  src  vite.config.js

./server:
index.js

./src:
App.css  App.jsx  components  main.jsx

./src/components:
Chat.css  Chat.jsx  DocumentManager.css  DocumentManager.jsx  Settings.css  Settings.jsx
```

## ✅ Step 3: Install Dependencies

```bash
npm install
```

Wait for completion. You should see packages like:
- express
- cors  
- react
- vite
- pdfjs-dist
- tesseract.js
- xlsx

## ✅ Step 4: Start Ollama

In a **separate terminal**:

```bash
ollama serve
```

Keep this running!

## ✅ Step 5: Pull Models

In **another terminal**:

```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

## ✅ Step 6: Start Application

Back in your project folder:

```bash
npm run dev
```

You should see:
```
🚀 LocalLLM Hub Server Running!
Server:        http://localhost:3001
Ollama:        http://localhost:11434

VITE v5.x.x  ready in XXX ms
➜  Local:   http://localhost:5173/
```

## ✅ Step 7: Test in Browser

Open: **http://localhost:5173**

You should see:
- LocalLLM Hub interface
- Sidebar with Chat, Documents, Settings tabs
- "Ollama: connected" with green dot

## 🐛 Troubleshooting

### Error: "Cannot find module 'express'"
```bash
npm install express cors multer express-fileupload dotenv
```

### Error: "Cannot find module 'react'"
```bash
npm install react react-dom
```

### Error: "Failed to resolve import"
Check that all files exist:
```bash
ls src/main.jsx
ls src/App.jsx
ls src/components/Chat.jsx
```

### Port 5173 shows blank page
Open browser console (F12) and check for errors. Usually means:
- Missing main.jsx
- Missing App.jsx
- Syntax error in JSX files

### Port 5173 shows 404
- Missing index.html
- Wrong working directory

### Ollama shows "disconnected"
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# If not working, restart Ollama
pkill ollama
ollama serve
```

## 📋 Quick Copy-Paste Commands

Run these in your `localllm-hub-web` folder:

```bash
# Create folders
mkdir -p server src/components

# Create .env
cat > .env << 'EOF'
PORT=3001
NODE_ENV=development
OLLAMA_URL=http://localhost:11434
EOF

# Verify structure
echo "Files in root:"
ls -1

echo "Files in server:"
ls -1 server/

echo "Files in src:"
ls -1 src/

echo "Files in src/components:"
ls -1 src/components/
```

## ✅ Final Verification

Before running `npm run dev`, verify you have:

**13 total files:**
1. package.json
2. vite.config.js
3. index.html
4. .env
5. server/index.js
6. src/main.jsx
7. src/App.jsx
8. src/App.css
9. src/components/Chat.jsx
10. src/components/Chat.css
11. src/components/DocumentManager.jsx
12. src/components/DocumentManager.css
13. src/components/Settings.jsx
14. src/components/Settings.css

If you're missing ANY of these, the app won't work!

## 🎯 Success Criteria

✅ `npm run dev` starts without errors
✅ Browser opens to http://localhost:5173
✅ Page loads with LocalLLM Hub interface
✅ Sidebar shows "Ollama: connected" (green)
✅ Can click on Chat, Documents, Settings tabs
✅ No errors in browser console

If all these pass, you're ready to use the app!
