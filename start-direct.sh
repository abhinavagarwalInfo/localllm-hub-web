#!/bin/bash
# ──────────────────────────────────────────────────────────
#  start-direct.sh
#  Cross-platform launcher for LocalLLM Hub (macOS/Linux)
#  Press Ctrl+C to stop everything cleanly.
# ──────────────────────────────────────────────────────────

# ── colours ──────────────────────────────────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; NC='\033[0m'

# ── resolve project root ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# If script is not next to package.json, try one level up
[ ! -f "package.json" ] && cd .. || true

# ── read PORT from .env if present ───────────────────────
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs) 2>/dev/null
fi
SERVER_PORT="${PORT:-3001}"

# ── banner ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║        🚀  LocalLLM Hub – Dev Server        ║${NC}"
echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}${CYAN}║${NC}  Backend  → ${GREEN}http://localhost:${SERVER_PORT}${NC}"
echo -e "${BOLD}${CYAN}║${NC}  Frontend → ${GREEN}http://localhost:5173${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── check if port is in use (cross-platform) ─────────────
# Try lsof (macOS/most Linux), fall back to netstat (universal)
port_check() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i ":$1" >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tuln 2>/dev/null | grep ":$1 " >/dev/null
  else
    return 1  # Can't check, assume port is free
  fi
}

kill_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti ":$1" | xargs kill -9 2>/dev/null
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "$1/tcp" 2>/dev/null
  else
    echo -e "${YELLOW}⚠  Cannot auto-kill port. Please manually stop process on :$1${NC}"
    return 1
  fi
}

if port_check "${SERVER_PORT}"; then
  echo -e "${YELLOW}⚠  Port ${SERVER_PORT} is already in use.${NC}"
  echo -e "   Killing existing process on :${SERVER_PORT} …"
  if kill_port "${SERVER_PORT}"; then
    sleep 1
    echo -e "${GREEN}   ✅ Cleared.${NC}\n"
  fi
fi

# ── install deps if missing ──────────────────────────────
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠  node_modules not found – running npm install …${NC}"
  npm install
  echo ""
fi

# ── launch ────────────────────────────────────────────────
echo -e "${GREEN}▶  Running: npm run dev${NC}\n"
npm run dev