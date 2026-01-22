# Claude Code + Next.js Dev Server Workaround

Just ask Claude:
```Apply the Claude Code + Next.js workaround from CLAUDE-CODE-NEXTJS-WORKAROUND.md```

## The Bug
Claude Code hangs indefinitely when running Next.js dev server with `run_in_background: true`. The UI shows "Creating... ↓ 0 tokens" and never progresses.

See [issue #20140](https://github.com/anthropics/claude-code/issues/20140) in github.

## The Fix
Use plain bash `&` instead of `run_in_background: true` for Next.js dev server.

### Instead of this (HANGS):
```javascript
// Claude Code using run_in_background: true
Bash({ command: "npm run dev", run_in_background: true })
```

### Do this (WORKS):
```javascript
// Plain bash background
Bash({ command: "npm run dev &" })
```

## Quick Setup for Any Project

Create `skills/dev-browser-wrapper.sh` with these key functions:

```bash
# Start Next.js with plain & (NOT run_in_background)
npm run dev > "$SCRIPT_DIR/app-server.log" 2>&1 &

# Start dev-browser with plain &
bash server.sh > "$SCRIPT_DIR/dev-browser-server.log" 2>&1 &
```

## Usage Pattern for Browser Testing

```bash
# 1. Start servers (uses plain & internally)
./skills/dev-browser-wrapper.sh start-all

# 2. Run browser automation script
cd <dev-browser-dir> && npx tsx <<'EOF'
import { connect, waitForPageLoad } from "@/client.js";
const client = await connect();
const page = await client.page("app");
await page.goto("http://localhost:3000");
// ... do testing ...
await client.disconnect();
EOF

# 3. Cleanup
./skills/dev-browser-wrapper.sh stop-all
```

## What Works vs What Hangs

| Command | `run_in_background: true` | Plain `&` |
|---------|---------------------------|-----------|
| `sleep` | OK | OK |
| `npm run build` | OK | OK |
| `npm run lint` | OK | OK |
| `node` script | OK | OK |
| **`npm run dev`** | **HANGS** | OK |
| **`npx next dev`** | **HANGS** | OK |

## Affected Versions
- Claude Code: 2.1.15
- Next.js: 16.1.2 (likely affects other versions too)
- OS: Windows (MINGW64), possibly others

## Bug Report
See `bug.md` for full details to submit to https://github.com/anthropics/claude-code/issues
