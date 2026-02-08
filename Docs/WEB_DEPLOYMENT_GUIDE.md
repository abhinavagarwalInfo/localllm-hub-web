# Web Deployment Guide - LocalLLM Hub

Complete guide to deploy your LocalLLM Hub as a web application accessible to anyone.

## 📋 Architecture Overview

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser   │ ◄─────► │ Node.js      │ ◄─────► │   Ollama     │
│  (React)    │         │ Express API  │         │   Server     │
└─────────────┘         └──────────────┘         └──────────────┘
    Users                   Port 3001              Port 11434
```

## 🚀 Quick Start (Local Development)

### Step 1: Setup Project Structure

Create a new folder `localllm-hub-web` and copy all the web version files into it:

```bash
mkdir localllm-hub-web
cd localllm-hub-web

# Create folder structure
mkdir -p server src/components

# Copy files (use the artifacts provided)
# - package.json (web version)
# - vite.config.js (web version)
# - server/index.js
# - src/App.jsx
# - src/components/Chat.jsx (web version)
# - src/components/DocumentManager.jsx (web version)
# - src/components/Settings.jsx
# - All CSS files
# - index.html
# - .env.example
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

```bash
# Copy environment file
cp .env.example .env

# Edit if needed
nano .env
```

### Step 4: Run Development Server

```bash
# This starts both backend and frontend
npm run dev
```

You should see:
```
🚀 LocalLLM Hub Server Running!
Server: http://localhost:3001
Vite dev server running at http://localhost:5173
```

### Step 5: Access Application

Open browser: **http://localhost:5173**

## 🌐 Production Deployment Options

### Option 1: Single Server Deployment (Easiest)

Deploy everything on one server with Ollama.

**Requirements:**
- Ubuntu/Debian server
- 16GB+ RAM (32GB recommended)
- GPU (optional but recommended for faster inference)

**Steps:**

1. **Install Ollama on Server**
```bash
curl https://ollama.ai/install.sh | sh
ollama serve &
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

2. **Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Upload Application**
```bash
# On your server
cd /var/www
git clone <your-repo> localllm-hub
cd localllm-hub
npm install
```

4. **Build Production Version**
```bash
NODE_ENV=production npm run build
```

5. **Configure Environment**
```bash
nano .env
```
Set:
```
PORT=3001
NODE_ENV=production
OLLAMA_URL=http://localhost:11434
```

6. **Run with PM2** (process manager)
```bash
sudo npm install -g pm2
pm2 start server/index.js --name localllm-hub
pm2 save
pm2 startup
```

7. **Setup Nginx Reverse Proxy**
```bash
sudo apt install nginx

sudo nano /etc/nginx/sites-available/localllm-hub
```

Add:
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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Increase timeouts for long-running requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/localllm-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

8. **Setup SSL (Optional but Recommended)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 2: Separate Ollama Server

Run Ollama on a powerful server, web app on another.

**Server 1 (Ollama Server):**
```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Allow external connections
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

**Server 2 (Web App):**
```bash
# Set environment
OLLAMA_URL=http://ollama-server-ip:11434
PORT=3001
NODE_ENV=production

# Build and run
npm run build
pm2 start server/index.js
```

### Option 3: Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "server/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped

  localllm-hub:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - OLLAMA_URL=http://ollama:11434
      - PORT=3001
    depends_on:
      - ollama
    restart: unless-stopped

volumes:
  ollama-data:
```

Run:
```bash
docker-compose up -d
```

### Option 4: Cloud Platform Deployment

#### **Heroku**
```bash
# Install Heroku CLI
heroku login
heroku create localllm-hub

# Set environment
heroku config:set NODE_ENV=production
heroku config:set OLLAMA_URL=http://your-ollama-server:11434

# Deploy
git push heroku main
```

#### **DigitalOcean App Platform**
1. Create new app from GitHub repo
2. Set environment variables
3. Deploy automatically

#### **AWS EC2**
Same as "Single Server Deployment" above.

#### **Vercel/Netlify**
Not recommended - need backend server for Ollama proxy.

## 🔒 Security Considerations

### 1. Authentication (Important for Public Deployment)

Add basic authentication to server/index.js:

```javascript
import basicAuth from 'express-basic-auth';

// Add before routes
app.use(basicAuth({
  users: { 'admin': 'your-secure-password' },
  challenge: true,
  realm: 'LocalLLM Hub'
}));
```

### 2. Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 3. File Upload Limits

Already configured in server/index.js (50MB max).

### 4. HTTPS

Always use SSL/TLS in production (via Nginx + Let's Encrypt).

### 5. Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## 📊 Performance Optimization

### 1. Enable Compression

```javascript
import compression from 'compression';
app.use(compression());
```

### 2. Caching

```javascript
// In server/index.js
app.use(express.static('dist', {
  maxAge: '1y',
  etag: true
}));
```

### 3. CDN

Serve static assets from CDN:
- Upload `dist/assets` to Cloudflare/AWS CloudFront
- Update build to use CDN URLs

## 🔧 Maintenance

### Update Application

```bash
cd /var/www/localllm-hub
git pull
npm install
npm run build
pm2 restart localllm-hub
```

### Monitor Logs

```bash
pm2 logs localllm-hub
```

### Check Status

```bash
pm2 status
pm2 monit
```

## 🐛 Troubleshooting

### Ollama Connection Failed

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Check from app server
curl http://ollama-server-ip:11434/api/tags

# Check firewall
sudo ufw status
```

### High Memory Usage

- Limit concurrent requests
- Use smaller models
- Add swap space
- Upgrade server RAM

### Slow Performance

- Use GPU acceleration for Ollama
- Enable response caching
- Use CDN for static assets
- Optimize chunk sizes

## 📈 Scaling

### Horizontal Scaling

Run multiple Ollama servers with load balancer:

```nginx
upstream ollama_backend {
    server ollama1:11434;
    server ollama2:11434;
    server ollama3:11434;
}

location /api/ollama/ {
    proxy_pass http://ollama_backend;
}
```

### Vertical Scaling

- Increase server resources
- Add GPU
- Use faster storage (NVMe SSD)

## 💰 Cost Estimates

### Self-Hosted (Monthly)

**Option 1: Basic**
- DigitalOcean Droplet (4 vCPU, 8GB): $48/month
- Domain: $12/year
- Total: ~$50/month

**Option 2: Performance**
- Hetzner Cloud CX41 (4 vCPU, 16GB): €16/month
- GPU addon: €50/month
- Domain: $12/year
- Total: ~$75/month

**Option 3: High-End**
- AWS EC2 g4dn.xlarge (GPU): ~$400/month
- + storage, bandwidth

### Managed Services

- Heroku: $25-200/month (+ separate Ollama server)
- DigitalOcean App Platform: $12-200/month

## ✅ Deployment Checklist

- [ ] Ollama installed and running
- [ ] Models downloaded (llama3.2:3b, nomic-embed-text)
- [ ] Node.js installed
- [ ] Application code uploaded
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured
- [ ] Production build created (`npm run build`)
- [ ] PM2 process manager setup
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate installed
- [ ] Firewall rules configured
- [ ] Authentication enabled (if public)
- [ ] Backup strategy in place
- [ ] Monitoring setup

## 🎯 Next Steps

After deployment:

1. **Test all features**
   - Upload different file types
   - Test chat functionality
   - Verify embeddings work

2. **Monitor performance**
   - Check response times
   - Monitor memory usage
   - Watch error logs

3. **Optimize**
   - Adjust chunk sizes
   - Fine-tune model parameters
   - Cache frequently accessed data

4. **Secure**
   - Add authentication
   - Enable rate limiting
   - Regular security updates

---

**Your LocalLLM Hub is now accessible to anyone on the web!** 🚀🌐