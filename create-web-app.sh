#!/bin/bash

# LocalLLM Hub Web - Complete Setup Script
# This script creates all necessary files for the web version

echo "🚀 Creating LocalLLM Hub Web Application..."
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p server
mkdir -p src/components
mkdir -p public

# Copy CSS files from desktop version
echo "📄 Copying CSS files..."
echo "Please copy these CSS files from your desktop app:"
echo "  - src/App.css"
echo "  - src/components/Chat.css"
echo "  - src/components/DocumentManager.css"
echo "  - src/components/Settings.css"
echo ""
echo "Press Enter when you've copied the CSS files..."
read

# Create .env file
echo "⚙️  Creating .env file..."
cat > .env << 'EOF'
PORT=3001
NODE_ENV=development
OLLAMA_URL=http://localhost:11434
EOF

echo "✅ .env created"

# Create .gitignore
echo "📝 Creating .gitignore..."
cat > .gitignore << 'EOF'
node_modules
dist
.env
.DS_Store
*.log
.vite
EOF

echo "✅ .gitignore created"

# Instructions
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Make sure you have all files from the artifacts:"
echo "   - package.json (web version)"
echo "   - vite.config.js (web version)"
echo "   - server/index.js"
echo "   - index.html"
echo "   - src/main.jsx"
echo "   - src/App.jsx"
echo "   - src/components/Chat.jsx (web version)"
echo "   - src/components/DocumentManager.jsx (web version)"
echo "   - src/components/Settings.jsx"
echo "   - All CSS files"
echo ""
echo "2. Install dependencies:"
echo "   npm install"
echo ""
echo "3. Start development server:"
echo "   npm run dev"
echo ""
echo "4. Open browser:"
echo "   http://localhost:5173"
echo ""
echo "Need help? Check README.md or WEB_DEPLOYMENT_GUIDE.md"
echo ""
