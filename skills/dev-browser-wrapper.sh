#!/bin/bash
# Wrapper script for dev-browser with timing and cleanup
# Usage: ./skills/dev-browser-wrapper.sh {start|stop|start-app|stop-app|start-all|stop-all|status}
#
# IMPORTANT: This script uses plain bash `&` for background processes instead of
# Claude Code's `run_in_background: true` parameter. This avoids a known bug where
# Next.js dev server + run_in_background causes Claude Code to hang indefinitely.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGFILE="$SCRIPT_DIR/dev-browser-debug.log"
PIDFILE="$SCRIPT_DIR/dev-browser-pids.txt"
APP_PIDFILE="$SCRIPT_DIR/app-server-pids.txt"

# Dev-browser plugin location
DEV_BROWSER_DIR="C:/Users/jerom/.claude/plugins/cache/dev-browser-marketplace/dev-browser/66682fb0513a/skills/dev-browser"

# App server port (Next.js default)
APP_PORT=3000

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] $1" | tee -a "$LOGFILE"
}

get_port_pid() {
    local port=$1
    netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $5}' | head -1
}

start_app() {
    log "========================================="
    log "START: Launching app server (Next.js)"

    # Check if already running
    local existing_pid=$(get_port_pid $APP_PORT)
    if [ -n "$existing_pid" ] && [ "$existing_pid" != "0" ]; then
        log "App server already running on port $APP_PORT (PID: $existing_pid)"
        log "========================================="
        return 0
    fi

    > "$APP_PIDFILE"

    cd "$PROJECT_DIR"
    log "Working directory: $(pwd)"

    # Start Next.js with plain & (NOT run_in_background to avoid Claude Code hang bug)
    npm run dev > "$SCRIPT_DIR/app-server.log" 2>&1 &
    local app_pid=$!
    echo "$app_pid" >> "$APP_PIDFILE"

    log "App server shell started with PID: $app_pid"

    # Wait for server to be ready
    log "Waiting for app server to be ready..."
    local max_wait=30
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT 2>/dev/null | grep -q "200"; then
            log "App server ready on port $APP_PORT"
            break
        fi
        sleep 1
        ((waited++))
    done

    if [ $waited -ge $max_wait ]; then
        log "WARNING: App server may not be ready after ${max_wait}s"
    fi

    # Record actual PID on port
    local port_pid=$(get_port_pid $APP_PORT)
    if [ -n "$port_pid" ] && [ "$port_pid" != "0" ]; then
        log "Found process on port $APP_PORT: PID $port_pid"
        echo "$port_pid" >> "$APP_PIDFILE"
    fi

    log "END: App server startup complete"
    log "========================================="
}

stop_app() {
    log "========================================="
    log "START: Stopping app server"

    local killed_count=0

    # Kill process on app port
    local pid=$(get_port_pid $APP_PORT)
    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
        log "Killing process on port $APP_PORT (PID: $pid)"
        taskkill //F //PID $pid 2>/dev/null && ((killed_count++))
    else
        log "No process found on port $APP_PORT"
    fi

    # Kill tracked PIDs
    if [ -f "$APP_PIDFILE" ]; then
        log "Killing tracked app PIDs:"
        while read pid; do
            if [ -n "$pid" ] && [ "$pid" != "0" ]; then
                log "  Attempting to kill PID: $pid"
                taskkill //F //PID $pid 2>/dev/null && ((killed_count++)) || true
            fi
        done < "$APP_PIDFILE"
        rm -f "$APP_PIDFILE"
    fi

    log "Killed $killed_count app processes"
    log "END: App server cleanup complete"
    log "========================================="
}

start_server() {
    log "========================================="
    log "START: Launching dev-browser server"
    > "$PIDFILE"

    if [ ! -d "$DEV_BROWSER_DIR" ]; then
        log "ERROR: Dev-browser directory not found at $DEV_BROWSER_DIR"
        return 1
    fi

    cd "$DEV_BROWSER_DIR"
    log "Working directory: $(pwd)"

    # Start the server with plain & (NOT run_in_background)
    bash server.sh > "$SCRIPT_DIR/dev-browser-server.log" 2>&1 &
    SERVER_PID=$!
    echo "$SERVER_PID" >> "$PIDFILE"

    log "Server shell started with PID: $SERVER_PID"

    # Wait for server to start
    sleep 3

    # Record processes on relevant ports
    for port in 9222 9223; do
        PID=$(get_port_pid $port)
        if [ -n "$PID" ] && [ "$PID" != "0" ]; then
            log "Found process on port $port: PID $PID"
            echo "$PID" >> "$PIDFILE"
        fi
    done

    log "END: Server startup complete"
    log "========================================="
}

stop_server() {
    log "========================================="
    log "START: Stopping dev-browser server"

    local killed_count=0

    # Kill processes on ports 9222 and 9223
    for port in 9222 9223; do
        PID=$(get_port_pid $port)
        if [ -n "$PID" ] && [ "$PID" != "0" ]; then
            log "Killing process on port $port (PID: $PID)"
            taskkill //F //PID $PID 2>/dev/null && ((killed_count++))
        else
            log "No process found on port $port"
        fi
    done

    # Kill tracked PIDs from file
    if [ -f "$PIDFILE" ]; then
        log "Killing tracked PIDs from $PIDFILE:"
        while read pid; do
            if [ -n "$pid" ] && [ "$pid" != "0" ]; then
                log "  Attempting to kill PID: $pid"
                taskkill //F //PID $pid 2>/dev/null && ((killed_count++)) || true
            fi
        done < "$PIDFILE"
        rm -f "$PIDFILE"
    fi

    # Kill any remaining orphan processes
    log "Checking for orphan processes..."
    ps aux 2>/dev/null | grep -E "start-server\.ts|chromium" | grep -v grep | while read line; do
        pid=$(echo "$line" | awk '{print $2}')
        if [ -n "$pid" ]; then
            log "  Killing orphan PID: $pid"
            taskkill //F //PID $pid 2>/dev/null
        fi
    done

    log "Killed $killed_count processes total"
    log "END: Server cleanup complete"
    log "========================================="
}

start_all() {
    log "========================================="
    log "START-ALL: Launching app and dev-browser servers"
    log "========================================="
    start_app
    start_server
    log "========================================="
    log "START-ALL: Complete - ready for browser automation"
    log "========================================="
}

stop_all() {
    log "========================================="
    log "STOP-ALL: Stopping all servers"
    log "========================================="
    stop_server
    stop_app
    log "========================================="
    log "STOP-ALL: Complete"
    log "========================================="
}

status() {
    log "========================================="
    log "STATUS CHECK"

    # Check app port
    local app_pid=$(get_port_pid $APP_PORT)
    if [ -n "$app_pid" ] && [ "$app_pid" != "0" ]; then
        log "Port $APP_PORT (app): ACTIVE (PID: $app_pid)"
    else
        log "Port $APP_PORT (app): FREE"
    fi

    # Check dev-browser ports
    for port in 9222 9223; do
        PID=$(get_port_pid $port)
        if [ -n "$PID" ] && [ "$PID" != "0" ]; then
            log "Port $port (dev-browser): ACTIVE (PID: $PID)"
        else
            log "Port $port (dev-browser): FREE"
        fi
    done

    # Check related processes
    log "Related processes:"
    ps aux 2>/dev/null | grep -E "(node|npx|chromium|next)" | grep -v grep | while read line; do
        log "  $line"
    done

    log "========================================="
}

case "$1" in
    start) start_server ;;
    stop) stop_server ;;
    start-app) start_app ;;
    stop-app) stop_app ;;
    start-all) start_all ;;
    stop-all) stop_all ;;
    status) status ;;
    *)
        echo "Usage: $0 {start|stop|start-app|stop-app|start-all|stop-all|status}"
        echo ""
        echo "Commands:"
        echo "  start      - Start dev-browser server only"
        echo "  stop       - Stop dev-browser server"
        echo "  start-app  - Start Next.js app server only"
        echo "  stop-app   - Stop Next.js app server"
        echo "  start-all  - Start both app and dev-browser servers"
        echo "  stop-all   - Stop all servers"
        echo "  status     - Show current server/process status"
        echo ""
        echo "NOTE: Uses plain bash & for background processes to avoid"
        echo "Claude Code hang bug with run_in_background + Next.js"
        ;;
esac
