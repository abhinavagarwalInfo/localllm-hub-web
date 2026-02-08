# 🌍 Cross-Platform Compatibility Guide

LocalLLM Hub works on **Windows, macOS, and Linux**. This guide shows platform-specific setup and launch methods.

---

## 📦 Platform Requirements

### All Platforms
- **Node.js 18+**
- **npm 8+**
- **Ollama** (with models pulled)
- **Git** (for cloning)

### Platform-Specific

| Platform | Additional Notes |
|----------|------------------|
| **Windows** | Use Command Prompt, PowerShell, or Git Bash |
| **macOS** | Terminal or iTerm2 |
| **Linux** | Any bash shell (Ubuntu, Fedora, Arch, etc.) |

---

## 🚀 Quick Start by Platform

### Windows

#### Option 1: Batch File (Easiest)
1. Double-click `start.bat`
2. Done!

#### Option 2: Command Prompt
```cmd
cd path\to\localllm-hub
node start.js
```

#### Option 3: Manual (Two terminals)
```cmd
REM Terminal 1 - Backend
node server\index.js

REM Terminal 2 - Frontend
npm run client
```

### macOS / Linux

#### Option 1: Bash Script (Recommended)
```bash
cd path/to/localllm-hub
chmod +x start-direct.sh    # Only needed once
./start-direct.sh
```

#### Option 2: Node.js (Universal)
```bash
cd path/to/localllm-hub
node start.js
```

#### Option 3: Manual (Two terminals)
```bash
# Terminal 1 - Backend
node server/index.js

# Terminal 2 - Frontend
npm run client
```

---

## 📂 Files Overview

| File | Platform | Purpose |
|------|----------|---------|
| `start.bat` | Windows | One-click launcher (batch) |
| `start-direct.sh` | macOS/Linux | Bash launcher |
| `start.js` | All | Universal Node.js launcher |

**All three do the same thing:**
1. Check/install dependencies
2. Kill any process on port 3001
3. Run `npm run dev` (starts both backend + frontend)

---

## 🛠 Platform-Specific Setup

### Windows

#### 1. Install Node.js
Download from: https://nodejs.org/
- Choose LTS version (18.x or 20.x)
- Default installation options are fine

Verify:
```cmd
node --version
npm --version
```

#### 2. Install Ollama
Download from: https://ollama.com/download
- Run installer
- Ollama runs as a background service automatically

Verify:
```cmd
curl http://localhost:11434/api/tags
```

#### 3. Pull Models
```cmd
ollama pull llama3.2
ollama pull nomic-embed-text
```

#### 4. Clone & Setup
```cmd
git clone https://github.com/yourusername/localllm-hub.git
cd localllm-hub
npm install
```

#### 5. Launch
Double-click `start.bat` or run:
```cmd
node start.js
```

---

### macOS

#### 1. Install Homebrew (if not installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. Install Node.js & Ollama
```bash
brew install node ollama
brew services start ollama
```

Verify:
```bash
node --version
npm --version
curl http://localhost:11434/api/tags
```

#### 3. Pull Models
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

#### 4. Clone & Setup
```bash
git clone https://github.com/yourusername/localllm-hub.git
cd localllm-hub
npm install
```

#### 5. Launch
```bash
chmod +x start-direct.sh
./start-direct.sh
```

---

### Linux (Ubuntu/Debian)

#### 1. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify:
```bash
node --version
npm --version
```

#### 2. Install Ollama
```bash
curl https://ollama.ai/install.sh | sh
sudo systemctl start ollama
sudo systemctl enable ollama
```

Verify:
```bash
curl http://localhost:11434/api/tags
```

#### 3. Pull Models
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

#### 4. Clone & Setup
```bash
git clone https://github.com/yourusername/localllm-hub.git
cd localllm-hub
npm install
```

#### 5. Launch
```bash
chmod +x start-direct.sh
./start-direct.sh
```

---

### Linux (Fedora/RHEL)

#### 1. Install Node.js
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs
```

#### 2-5: Same as Ubuntu above

---

### Linux (Arch)

#### 1. Install Node.js
```bash
sudo pacman -S nodejs npm
```

#### 2-5: Same as Ubuntu above

---

## 🐛 Platform-Specific Troubleshooting

### Windows

#### Port 3001 already in use
```cmd
netstat -ano | findstr :3001
REM Note the PID in the last column, then:
taskkill /F /PID <PID>
```

#### "npm: command not found"
- Add Node.js to PATH: Environment Variables → System Variables → Path → Add `C:\Program Files\nodejs\`
- Restart Command Prompt

#### Ollama not running
```cmd
REM Check if Ollama service is running in Task Manager
REM Or restart it:
net stop ollama
net start ollama
```

---

### macOS

#### Port 3001 already in use
```bash
lsof -ti :3001 | xargs kill -9
```

#### Permission denied on start-direct.sh
```bash
chmod +x start-direct.sh
```

#### Ollama not running
```bash
brew services restart ollama
# Or manually:
ollama serve
```

---

### Linux

#### Port 3001 already in use
```bash
# Method 1: lsof (most distros)
lsof -ti :3001 | xargs kill -9

# Method 2: fuser (if lsof not available)
fuser -k 3001/tcp

# Method 3: netstat (universal)
netstat -tuln | grep :3001
kill -9 <PID>
```

#### Permission issues
```bash
chmod +x start-direct.sh
# If npm install fails with EACCES:
sudo chown -R $USER:$USER ~/.npm
```

#### Ollama not running
```bash
sudo systemctl status ollama
sudo systemctl restart ollama
```

---

## 🔧 File Path Differences

The code automatically handles path separators:

| Platform | Separator | Example |
|----------|-----------|---------|
| Windows | `\` | `C:\Users\You\localllm-hub` |
| macOS | `/` | `/Users/you/localllm-hub` |
| Linux | `/` | `/home/you/localllm-hub` |

Node.js `path` module handles this automatically - no changes needed!

---

## ✅ Verification Checklist

After installation on any platform:

- [ ] `node --version` shows 18+
- [ ] `npm --version` shows 8+
- [ ] `curl http://localhost:11434/api/tags` returns model list
- [ ] `ollama list` shows llama3.2 and nomic-embed-text
- [ ] `npm install` completes without errors
- [ ] Launcher starts both backend (3001) and frontend (5173)
- [ ] Browser loads http://localhost:5173
- [ ] Login works with admin/admin123
- [ ] Can upload a document
- [ ] Can chat and get responses

---

## 🌐 Network Access (All Platforms)

The app works on your local network from any platform:

1. Note the Network URL when Vite starts:
   ```
   ➜  Network: http://192.168.x.x:5173/
   ```

2. Open that URL from any device (phone, tablet, other computer)

3. Works identically - no platform restrictions!

---

## 📝 Summary

**Best launcher for each platform:**

- **Windows** → `start.bat` (double-click) or `node start.js`
- **macOS** → `./start-direct.sh` or `node start.js`  
- **Linux** → `./start-direct.sh` or `node start.js`

All launchers do the same thing - pick whichever is easiest!
