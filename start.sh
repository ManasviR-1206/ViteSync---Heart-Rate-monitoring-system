#!/bin/bash
# ============================================================
#  VitalSync rPPG — Start Script (Mac / Linux)
#  Starts backend + frontend in parallel
# ============================================================

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   VitalSync rPPG — v3  Starting...   ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Check Python
if ! command -v python3 &>/dev/null; then
  echo -e "${RED}✗ python3 not found. Install Python 3.9+${NC}"; exit 1
fi
echo -e "${GREEN}✓ Python:${NC} $(python3 --version)"

# ── Check Node
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ node not found. Install Node.js 18+${NC}"; exit 1
fi
echo -e "${GREEN}✓ Node:${NC} $(node --version)"

# ── Backend venv
echo ""
echo -e "${YELLOW}▶ Setting up Python backend...${NC}"
cd "$BACKEND"

if [ ! -d "venv" ]; then
  echo "  Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
echo "  Installing Python deps..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo -e "${GREEN}  ✓ Backend ready${NC}"

# ── Frontend deps
echo ""
echo -e "${YELLOW}▶ Setting up React frontend...${NC}"
cd "$FRONTEND"
if [ ! -d "node_modules" ]; then
  echo "  Installing npm packages (first run — takes ~1 min)..."
  npm install --legacy-peer-deps --silent
fi
echo -e "${GREEN}  ✓ Frontend ready${NC}"

# ── Launch both
echo ""
echo -e "${CYAN}${BOLD}Launching backend  → http://localhost:5000${NC}"
echo -e "${CYAN}${BOLD}Launching frontend → http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Start backend in background
cd "$BACKEND"
source venv/bin/activate
python3 app.py &
BACKEND_PID=$!

# Give backend 2s to boot
sleep 2

# Start frontend (foreground)
cd "$FRONTEND"
npm run dev -- --open &
FRONTEND_PID=$!

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping servers...${NC}"
  kill $BACKEND_PID  2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}Stopped. Bye!${NC}"
}
trap cleanup EXIT INT TERM

wait $FRONTEND_PID
