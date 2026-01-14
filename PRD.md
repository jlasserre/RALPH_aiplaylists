# AI Playlist Generator - Implementation Plan

## Overview
A Next.js web app that generates Spotify playlists using LLM (Claude/OpenAI) based on user descriptions.

## Tech Stack
- **Frontend**: React + Next.js 14 (App Router) + Tailwind CSS
- **State**: Zustand (persisted to localStorage for auth tokens)
- **Auth**: Spotify OAuth PKCE flow
- **LLM**: Support both OpenAI and Claude (configurable)

---

## UI Layout - Three Panels

```
┌─────────────────┬──────────────────────┬──────────────────────┐
│   LEFT PANEL    │    MIDDLE PANEL      │    RIGHT PANEL       │
│   (Controls)    │    (Candidates)      │    (Your Playlist)   │
├─────────────────┼──────────────────────┼──────────────────────┤
│ [New Playlist]  │  Songs from current  │  Accumulated songs   │
│ [Load Existing▾]│  prompt generation   │  across all prompts  │
│                 │                      │                      │
│ Playlist Name:  │  ☑ Song A           │  🎵 Song X (synced)  │
│ [Summer Vibes]  │  ☐ Song B           │  🎵 Song Y (synced)  │
│                 │  ☑ Song C           │  +  Song A (pending) │
│ Prompt:         │                      │  🚫 Song Z (remove)  │
│ [upbeat 90s...] │  [Add Selected →]    │                      │
│                 │                      │  [Create/Update]     │
│ [Suggest songs] │                      │                      │
└─────────────────┴──────────────────────┴──────────────────────┘
```

**Song states in Right Panel:**
- 🎵 **Synced** - small Spotify icon, already in Spotify playlist
  - Tooltip: "This song is in your Spotify playlist"
- `+` **Pending** - plus icon, will be added on next sync
  - Tooltip: "This song will be added when you save"
- 🎵🚫 **Marked for removal** - Spotify icon with red "forbidden" overlay (⃠)
  - Tooltip: "This song will be removed when you save"

**User can:**
- Click song in right panel to toggle removal (🎵 ↔ 🚫)
- Remove pending songs before syncing
- Re-add removed songs

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   └── api/
│       ├── auth/spotify/route.ts         # OAuth initiate
│       ├── auth/spotify/callback/route.ts # OAuth callback
│       ├── auth/refresh/route.ts         # Token refresh
│       ├── generate/route.ts             # LLM song generation
│       ├── generate/more-like-this/route.ts
│       ├── generate/suggest-name/route.ts
│       ├── spotify/search/route.ts
│       └── spotify/playlist/route.ts     # Create/update playlist
├── components/
│   ├── ui/                               # Button, Input, TextArea, Card, Checkbox
│   ├── layout/                           # ThreePanelLayout, LeftPanel, MiddlePanel, RightPanel
│   └── features/
│       ├── playlist/                     # PlaylistRequest, CandidateList, PlaylistView, SongCard
│       └── auth/                         # SpotifyLoginButton, AuthStatus
├── lib/
│   ├── spotify/                          # auth.ts, api.ts
│   └── llm/                              # index.ts (factory), claude.ts, openai.ts, prompts.ts
├── store/                                # authStore.ts, playlistStore.ts, candidateStore.ts
├── hooks/                                # useSpotifyAuth, usePlaylist, useCandidates
└── types/                                # playlist.ts, song.ts, api.ts
```

---

## Implementation Phases

### Phase 1: Project Setup
1. Initialize Next.js with `npx create-next-app@latest --typescript --tailwind --app`
2. Install dependencies: `zustand`, `@anthropic-ai/sdk`, `openai`
3. Create `.env.local` with Spotify client ID, LLM API keys

### Phase 2: Spotify Auth (PKCE Flow)
1. Implement `src/lib/spotify/auth.ts` - PKCE code verifier/challenge generation
2. Create `/api/auth/spotify` - redirect to Spotify authorization
3. Create `/api/auth/spotify/callback` - exchange code for tokens
4. Create `/api/auth/refresh` - refresh expired tokens
5. Build `authStore.ts` with Zustand (persisted)

### Phase 3: Core UI Components
1. Build `ThreePanelLayout` - responsive layout (left/middle/right)
2. Create `LeftPanel` with playlist controls, name input, prompt textarea
3. Create `MiddlePanel` with `CandidateList` and selection controls
4. Create `RightPanel` with `PlaylistView` and sync state indicators
5. Add `SongCard` component with drag-drop, tooltips, state icons
6. Add skeleton loaders for loading states

### Phase 4: LLM Integration
1. Create LLM factory in `src/lib/llm/index.ts`
2. Define canonical song schema: `{ title, artist, album?, year? }`
3. Implement `ClaudeClient` with structured prompts
4. Implement `OpenAIClient` as alternative
5. Add provider failover (switch if quota hit or error)
6. Build `/api/generate` endpoint - calls LLM, returns song suggestions
7. Add `/api/generate/suggest-name` for playlist naming

### Phase 5: Spotify API Integration
1. Build `SpotifyClient` class in `src/lib/spotify/api.ts`
2. Implement `searchTracks()` - find songs from LLM suggestions
3. Implement song matching with fuzzy search for better accuracy
4. Create `/api/spotify/playlist` - POST creates, PUT updates
5. Add Spotify recommendations API for "more like this"

### Phase 6: State Management
1. Complete `playlistStore.ts` - songs, selections, session tracking
2. Wire up UI to store actions
3. Implement session-based updates (same session = update, not create)
4. Handle selection/deselection of songs

---

## Key Features Implementation

### Starting a Session
**New Playlist:**
- Click "New Playlist" → clears all panels, fresh start
- Right panel empty, ready to build from scratch

**Load Existing Playlist:**
- Click "Load Existing" → dropdown shows user's Spotify playlists
- Shows both owned playlists and followed playlists (marked with 🔒)
- Select playlist → fetches songs from Spotify
- Right panel populated with existing songs

**Owned vs. Followed Playlists:**
- **Owned playlist**: Songs show 🎵 (in Spotify), button shows "Update Playlist"
- **Followed/read-only playlist**:
  - Banner: "This playlist is read-only. Changes will create a new playlist."
  - Songs marked as "pending" (will be added to new playlist)
  - Playlist name field cleared (user must provide new name)
  - Button shows "Create Playlist"

### Multi-Prompt Workflow
1. User enters prompt → generates candidates in middle panel
2. User selects candidates → "Add Selected" moves them to right panel (pending)
3. User enters another prompt → new candidates replace middle panel
4. User selects more → adds to right panel
5. Repeat as needed
6. Click "Create/Update" → syncs right panel with Spotify

### Candidate Selection (Middle Panel)
- Each song has a checkbox
- "Add Selected →" button moves checked songs to playlist
- Candidates cleared when new prompt is generated
- **Drag & drop**: Drag songs directly to right panel to add

### Drag & Drop Support (Desktop/Tablet Only)
- **Middle → Right**: Drag candidates to add to playlist (becomes pending +)
- **Within Right**: Drag to reorder songs in playlist
- **Right → Middle**:
  - Synced song (🎵) → marks for removal (🚫), stays in right panel
  - Pending song (+) → removed from right panel entirely
- Visual feedback: Drop zone highlights when dragging over

### Playlist Management (Right Panel)
- Shows all accumulated songs across prompts
- Visual states: 🎵 (in Spotify), + (pending), 🚫 (marked for removal)
- Click song to toggle removal (🎵 ↔ 🚫)
- Can remove pending songs before syncing

### "More Like This" (Single Song)
- Available on songs in both middle and right panels
- Uses Spotify Recommendations API with that song as seed
- Inserts similar songs just after the source song, auto-selected

### "Generate Prompt From Tagged" (Multiple Songs)
- User can tag multiple songs in middle and/or right panel (toggle tag icon)
- "Generate Prompt" button appears when songs are tagged
- Creates a suggested prompt in left panel: "Songs similar to [Song A] by [Artist], [Song B] by [Artist]..."
- User can edit the prompt before generating (add mood, era, exclude certain styles, etc.)
- User clicks "Generate" to send edited prompt to LLM
- Clears tags after prompt is generated
- if user tags additional songs, or untags tagged songs, the prompt is updated to reflect these changes.

### Playlist Name
- Auto-suggested by LLM based on first prompt
- User can edit anytime in left panel
- Shown as placeholder until customized

### Create/Update Playlist Flow

**First-time creation:**
1. User clicks "Create Playlist"
2. Check if playlist name exists on Spotify (`GET /v1/me/playlists`)
3. If name conflict, show dialog:
   > "A playlist named '[Name]' already exists. What would you like to do?"
   - **Add new songs to it** → append to existing playlist
   - **Replace its current contents** → overwrite existing playlist
   - **Create a new playlist with a different name** → prompt for new name
4. If no conflict, create new playlist
5. Store `spotify_playlist_id` in session - this playlist is now "active"

**Within same session:**
- Any changes update the active playlist (add pending, remove marked)
- No name conflict check needed - we're updating, not creating
- Button label changes to "Update Playlist"

**Session Persistence:**
- Auto-persist session to localStorage and restore on refresh
- Show persistent label: "Active playlist: [Name]" in header
- "New Playlist" button explicitly clears session

---

## Limitations & Guardrails

### LLM Generation
- **Songs per generation**: 15-25 songs (configurable, default 20)
- **Prompt min length**: 10 characters
- **Prompt max length**: 5000 characters
- **Rate limit**: Max 10 generations per minute per session

### Spotify Constraints
- **Playlist name**: 1-100 characters (Spotify limit)
- **Playlist description**: Max 300 characters
- **Max tracks per playlist**: 10,000 (Spotify limit, warn at 500+)
- **API rate limiting**: Respect Spotify's rate limits (429 responses), implement exponential backoff

### Validation Rules
- Empty playlist name → use auto-suggested name
- Duplicate songs → allow adding same track twice but warn user and visually flag duplicate songs.
- Invalid Spotify tracks → filter out, show warning count
- Prompt injection → sanitize LLM prompts (no system override attempts)

### User Feedback
- Show skeleton loaders for candidate songs during generation
- Display match rate early and continuously (X of Y songs found on Spotify)
- Warn when playlist is getting large (500+ songs)
- Error messages for API failures with retry option

---

## Performance

### Spotify Search Optimization
- **Batch searches**: Use concurrency queue (5-10 in flight max) to avoid 429s
- **Throttling**: Implement exponential backoff on rate limit responses
- **Caching**: Cache search results per session
  - Cache key: normalized `title + artist` or raw LLM tokens
  - Invalidate on session clear only

### LLM Latency Handling
- Show skeleton UI immediately on generate
- Stream match results as they come in (don't wait for all 20)
- Allow user to cancel ongoing generation

---

## Security

### OAuth Token Handling
- **PKCE**: Code verifier never leaves client until token exchange
- **Token exchange**: Happens server-side only (via API route)
- **Storage**: Use httpOnly cookies for refresh token (preferred)
  - Fallback: localStorage with CSP headers + Trusted Types
  - Never store client_secret on frontend

### LLM Security
- **Prompt sanitization**: Strip system override attempts
- **No PII to LLM**: Never send Spotify tokens, user IDs, or emails
- **Strict system prompts**: Keep model instructions fixed, user input separate

### API Security
- **Rate limiting**:
  - IP level: 100 req/min
  - Session level: 10 generations/min
- **CSRF tokens**: Required for all write actions (playlist create/update)
- **CORS**: Restrict to trusted origins only

### Content Security
- CSP headers configured
- No untrusted HTML rendering
- Trusted Types enabled

---

## Environment Variables

```env
# Spotify OAuth
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=...
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback

# LLM APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=claude
```

---

## Verification Plan

1. **Auth Flow**: Login with Spotify, verify token stored, test refresh
2. **Load Existing**: Load existing playlist, verify songs appear in right panel with 🎵 icon
3. **Generation**: Enter prompt, verify LLM returns songs, verify Spotify search finds them
4. **Multi-Prompt**: Enter second prompt, verify new candidates appear, add to playlist
5. **Song Management**: Select/deselect songs, verify correct state icons
6. **Playlist Creation**: Create new playlist, verify appears in Spotify with correct tracks
7. **Playlist Update**: Add/remove songs from loaded playlist, update, verify Spotify reflects changes
8. **More Like This**: Click on song, verify similar songs added after it
9. **Generate Prompt From Tagged**: Tag songs, click "Generate Prompt", verify prompt appears in left panel

---

## Critical Files to Create/Modify

1. `/src/lib/spotify/auth.ts` - OAuth PKCE implementation
2. `/src/lib/spotify/api.ts` - Spotify API wrapper (search, create/update playlist)
3. `/src/lib/llm/index.ts` - LLM factory (Claude + OpenAI)
4. `/src/store/playlistStore.ts` - Central state management (playlist, sync states)
5. `/src/store/candidateStore.ts` - Candidate songs from current prompt
6. `/src/app/api/generate/route.ts` - Main generation endpoint
7. `/src/app/page.tsx` - Three-panel layout composition
8. `/src/components/features/playlist/SongCard.tsx` - Song with state indicators
