#!/usr/bin/env bash
# UrbanMind supervisor - one command to run the whole app.
# - Cleans stale processes on :8000 and :5173.
# - Clears Vite's dep cache so no ghost modules haunt the browser.
# - Starts backend + frontend with auto-restart on crash.
# - Interleaves logs into this terminal (backend with agent traces, frontend with vite output).
# Ctrl+C stops everything cleanly.

set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ---- colors ----
C_INFO='\033[1;36m'; C_OK='\033[1;32m'; C_WARN='\033[1;33m'; C_ERR='\033[1;31m'; C_RST='\033[0m'
say()  { printf "${C_INFO}[urbanmind]${C_RST} %s\n" "$*"; }
ok()   { printf "${C_OK}[urbanmind]${C_RST} %s\n" "$*"; }
warn() { printf "${C_WARN}[urbanmind]${C_RST} %s\n" "$*"; }
err()  { printf "${C_ERR}[urbanmind]${C_RST} %s\n" "$*" >&2; }

# ---- cleanup on exit ----
BACKEND_PID=""; FRONTEND_PID=""
cleanup() {
  say "shutting down..."
  # kill process groups so children die too
  [ -n "$BACKEND_PID" ]  && kill -TERM -"$BACKEND_PID"  2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill -TERM -"$FRONTEND_PID" 2>/dev/null
  sleep 1
  [ -n "$BACKEND_PID" ]  && kill -KILL -"$BACKEND_PID"  2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill -KILL -"$FRONTEND_PID" 2>/dev/null
  # last-resort port cleanup
  lsof -ti:8000 2>/dev/null | xargs -r kill -9 2>/dev/null
  lsof -ti:5173 2>/dev/null | xargs -r kill -9 2>/dev/null
  ok "stopped."
  exit 0
}
trap cleanup INT TERM

# ---- pre-flight ----
say "killing anything on :8000 and :5173..."
lsof -ti:8000 2>/dev/null | xargs -r kill -9 2>/dev/null
lsof -ti:5173 2>/dev/null | xargs -r kill -9 2>/dev/null
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "node .*/vite" 2>/dev/null
sleep 1

if lsof -ti:8000 >/dev/null 2>&1 || lsof -ti:5173 >/dev/null 2>&1; then
  err "port :8000 or :5173 still busy after kill. Investigate manually:"
  err "  lsof -i :8000 -i :5173"
  exit 1
fi

say "clearing vite dep cache to avoid stale chunks..."
rm -rf "$FRONTEND/node_modules/.vite" 2>/dev/null

if [ ! -d "$BACKEND/venv" ]; then
  err "backend venv missing. Run: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi
if [ ! -d "$FRONTEND/node_modules" ]; then
  say "installing frontend deps..."
  (cd "$FRONTEND" && npm install) || { err "npm install failed"; exit 1; }
fi

# ---- launcher with auto-restart ----
# $1: label   $2: command   $3: cwd
# Streams stdout+stderr through a prefixer. If the process dies with non-zero
# exit and we did not get SIGINT/SIGTERM, it is restarted after 2s.
run_with_restart() {
  local label="$1"; shift
  local cwd="$1"; shift
  local prefix_color="$1"; shift
  local cmd="$*"

  (
    set -m
    while true; do
      printf "${prefix_color}[%s]${C_RST} starting: %s\n" "$label" "$cmd"
      (
        cd "$cwd" || exit 99
        # shellcheck disable=SC2086
        eval $cmd 2>&1 | while IFS= read -r line; do
          printf "${prefix_color}[%s]${C_RST} %s\n" "$label" "$line"
        done
      )
      code=$?
      if [ "$code" -eq 130 ] || [ "$code" -eq 143 ]; then
        printf "${prefix_color}[%s]${C_RST} stopped by signal, not restarting.\n" "$label"
        break
      fi
      printf "${C_WARN}[%s]${C_RST} exited with code %s — restarting in 2s...\n" "$label" "$code"
      sleep 2
    done
  ) &
  echo $!
}

# ---- backend ----
BACKEND_CMD='source venv/bin/activate && exec uvicorn main:app --port 8000 --host 0.0.0.0'
BACKEND_PID=$(run_with_restart "backend " "$BACKEND" "$C_OK" "$BACKEND_CMD")

# ---- frontend ----
FRONTEND_CMD='exec npm run dev -- --host --strictPort'
FRONTEND_PID=$(run_with_restart "frontend" "$FRONTEND" "$C_INFO" "$FRONTEND_CMD")

ok "backend  supervisor pid=$BACKEND_PID"
ok "frontend supervisor pid=$FRONTEND_PID"
say "operator dashboard : http://localhost:5173/"
say "citizen page       : http://localhost:5173/citizen"
say "ambulance crew     : http://localhost:5173/dept/ambulance"
say "watching logs... (Ctrl+C to stop both)"
echo

# wait indefinitely; cleanup trap handles Ctrl+C
wait
