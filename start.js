#!/usr/bin/env node
/**
 * start.js - Universal cross-platform launcher for LocalLLM Hub
 * Works on Windows, macOS, and Linux
 * 
 * Usage:
 *   node start.js
 *   npm start  (if configured in package.json)
 */

const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');
const net = require('net');

// ── Configuration ────────────────────────────────────────────
const SERVER_PORT = process.env.PORT || 3001;
const FRONTEND_PORT = 5173;

// ── Colors (ANSI) ────────────────────────────────────────────
const colors = {
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// ── Banner ───────────────────────────────────────────────────
console.log('\n' + c('bold', c('cyan', '╔══════════════════════════════════════════════╗')));
console.log(c('bold', c('cyan', '║        🚀  LocalLLM Hub – Dev Server        ║')));
console.log(c('bold', c('cyan', '╠══════════════════════════════════════════════╣')));
console.log(c('bold', c('cyan', '║')) + `  Backend  → ${c('green', `http://localhost:${SERVER_PORT}`)}`);
console.log(c('bold', c('cyan', '║')) + `  Frontend → ${c('green', `http://localhost:${FRONTEND_PORT}`)}`);
console.log(c('bold', c('cyan', '╚══════════════════════════════════════════════╝')));
console.log('');

// ── Check if port is in use ──────────────────────────────────
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    
    server.listen(port);
  });
}

// ── Kill process on port (best effort) ──────────────────────
function killPort(port) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    let cmd, args;
    if (isWindows) {
      // Windows: netstat + taskkill
      cmd = 'cmd';
      args = ['/c', `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`];
    } else {
      // Unix: lsof or fuser
      cmd = 'sh';
      args = ['-c', `lsof -ti :${port} | xargs kill -9 2>/dev/null || fuser -k ${port}/tcp 2>/dev/null || echo "Could not kill port"`];
    }
    
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('close', () => {
      setTimeout(resolve, 1000); // Wait 1s for process to die
    });
    proc.on('error', resolve);
  });
}

// ── Check node_modules ───────────────────────────────────────
async function checkDependencies() {
  if (!existsSync(join(__dirname, 'node_modules'))) {
    console.log(c('yellow', '⚠  node_modules not found – running npm install...'));
    console.log('');
    
    return new Promise((resolve, reject) => {
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const install = spawn(npm, ['install'], { 
        stdio: 'inherit',
        shell: true 
      });
      
      install.on('close', (code) => {
        if (code !== 0) {
          console.log(c('red', '\n✗ npm install failed!'));
          reject(new Error('npm install failed'));
        } else {
          console.log('');
          resolve();
        }
      });
    });
  }
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  try {
    // Check if backend port is in use
    const portInUse = await checkPort(SERVER_PORT);
    
    if (portInUse) {
      console.log(c('yellow', `⚠  Port ${SERVER_PORT} is already in use.`));
      console.log(c('yellow', `   Attempting to kill existing process...`));
      await killPort(SERVER_PORT);
      console.log(c('green', '   ✅ Cleared.\n'));
    }
    
    // Check dependencies
    await checkDependencies();
    
    // Launch npm run dev
    console.log(c('green', '▶  Running: npm run dev\n'));
    
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const dev = spawn(npm, ['run', 'dev'], {
      stdio: 'inherit',
      shell: true
    });
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\n' + c('yellow', '⏹  Shutting down...'));
      dev.kill('SIGINT');
      process.exit(0);
    });
    
    dev.on('close', (code) => {
      if (code !== 0) {
        console.log(c('red', `\n✗ Server stopped with errors (code ${code})`));
        process.exit(code);
      } else {
        console.log(c('green', '\n✓ Server stopped cleanly'));
        process.exit(0);
      }
    });
    
  } catch (error) {
    console.error(c('red', `\n✗ Error: ${error.message}`));
    process.exit(1);
  }
}

main();
