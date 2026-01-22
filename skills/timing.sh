#!/bin/bash
# General timing diagnostics helper
# Source this file to use timing functions: source skills/timing.sh
#
# Functions:
#   timing_start "operation name"    - Log start of an operation
#   timing_end "operation name"      - Log end of an operation
#   timing_checkpoint "description"  - Log a checkpoint during operation
#   process_snapshot                 - Log all relevant running processes
#   timing_clear                     - Clear the timing log

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMING_LOG="$SCRIPT_DIR/timing.log"

# Initialize log with header if it doesn't exist or is empty
if [ ! -s "$TIMING_LOG" ]; then
    echo "# Timing Diagnostics Log" > "$TIMING_LOG"
    echo "# Generated: $(date '+%Y-%m-%d %H:%M:%S')" >> "$TIMING_LOG"
    echo "" >> "$TIMING_LOG"
fi

timing_start() {
    local operation="$1"
    echo "" >> "$TIMING_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] ======= START: $operation =======" >> "$TIMING_LOG"
}

timing_end() {
    local operation="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] ======= END: $operation =======" >> "$TIMING_LOG"
    echo "" >> "$TIMING_LOG"
}

timing_checkpoint() {
    local description="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] CHECKPOINT: $description" >> "$TIMING_LOG"
}

timing_log() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] $message" >> "$TIMING_LOG"
}

process_snapshot() {
    local label="${1:-snapshot}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] PROCESSES ($label):" >> "$TIMING_LOG"

    # Count processes - use tr to clean up output
    local node_count=$(ps aux 2>/dev/null | grep "[n]ode" | wc -l | tr -d '[:space:]')
    local chrome_count=$(ps aux 2>/dev/null | grep "[c]hromium" | wc -l | tr -d '[:space:]')
    local npx_count=$(ps aux 2>/dev/null | grep "[n]px" | wc -l | tr -d '[:space:]')

    # Default to 0 if empty
    node_count=${node_count:-0}
    chrome_count=${chrome_count:-0}
    npx_count=${npx_count:-0}

    echo "  Node processes: $node_count" >> "$TIMING_LOG"
    echo "  Chrome processes: $chrome_count" >> "$TIMING_LOG"
    echo "  NPX processes: $npx_count" >> "$TIMING_LOG"

    # Show details if any found
    local total=$((node_count + chrome_count + npx_count))
    if [ "$total" -gt 0 ]; then
        echo "  Details:" >> "$TIMING_LOG"
        ps aux 2>/dev/null | grep -E "(node|chrome|chromium|npx)" | grep -v grep | while read line; do
            echo "    $line" >> "$TIMING_LOG"
        done
    fi

    # Check ports
    echo "  Ports:" >> "$TIMING_LOG"
    for port in 9222 9223 3000 3001; do
        local pid=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $5}' | head -1)
        if [ -n "$pid" ] && [ "$pid" != "0" ]; then
            echo "    Port $port: PID $pid" >> "$TIMING_LOG"
        fi
    done

    echo "  ---" >> "$TIMING_LOG"
}

timing_clear() {
    > "$TIMING_LOG"
    echo "# Timing Diagnostics Log" > "$TIMING_LOG"
    echo "# Cleared: $(date '+%Y-%m-%d %H:%M:%S')" >> "$TIMING_LOG"
    echo "" >> "$TIMING_LOG"
    echo "Timing log cleared."
}

timing_view() {
    if [ -f "$TIMING_LOG" ]; then
        cat "$TIMING_LOG"
    else
        echo "No timing log found at $TIMING_LOG"
    fi
}

# If script is run directly (not sourced), handle commands
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "$1" in
        clear) timing_clear ;;
        view) timing_view ;;
        snapshot) process_snapshot "${2:-manual}" ;;
        *)
            echo "Usage: $0 {clear|view|snapshot [label]}"
            echo "  Or source this file to use functions directly:"
            echo "    source $0"
            echo "    timing_start 'my operation'"
            echo "    timing_checkpoint 'step 1 done'"
            echo "    timing_end 'my operation'"
            ;;
    esac
fi
