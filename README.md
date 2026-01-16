# AI Playlist Generator

A Next.js web app that generates Spotify playlists using LLM (Claude/OpenAI) based on natural language descriptions. Describe the vibe you're looking for, and the AI suggests songs that match.

## Features

- **AI-Powered Song Suggestions**: Describe your desired playlist (e.g., "upbeat 90s dance hits" or "chill acoustic coffee shop vibes") and get song recommendations from Claude or OpenAI
- **Direct Spotify Integration**: Search for songs on Spotify, create new playlists, or update existing ones
- **Three-Panel Interface**: Controls on the left, AI suggestions in the middle, your playlist on the right
- **Drag & Drop**: Easily add songs to your playlist or reorder them
- **Tag & Generate**: Tag multiple songs and generate new prompts based on your selections
- **"More Like This"**: Get similar song recommendations based on any song in your list

## Prerequisites

- **Node.js**: v18.17 or later (v20+ recommended)
- **npm**: v9 or later
- **Spotify Account**: Free or Premium (needed for OAuth)
- **LLM API Key**: OpenAI API key and/or Anthropic API key

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd RALPH_aiplaylists
npm install
```

### 2. Create Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **Create App**
4. Fill in the app details:
   - **App name**: AI Playlist Generator (or any name you prefer)
   - **App description**: Generate playlists with AI
   - **Redirect URI**: `http://127.0.0.1:3000/api/auth/spotify/callback`
   - Check the **Web API** checkbox
5. Click **Save**
6. On your app's dashboard, click **Settings**
7. Copy the **Client ID** - you'll need this for your environment variables

> **Important**: Use `127.0.0.1` instead of `localhost` in your redirect URI. Spotify treats them differently, and the OAuth flow requires an exact match between the registered URI and the one used in the app.

### 3. Get LLM API Keys

You need at least one of these:

**For OpenAI (GPT-4):**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **Create new secret key**
4. Copy the key (starts with `sk-`)

**For Anthropic (Claude):**
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

### 4. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` with your actual values:
   ```env
   # Spotify OAuth
   NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_actual_spotify_client_id
   NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback

   # LLM APIs (at least one required)
   OPENAI_API_KEY=sk-your_actual_openai_key
   ANTHROPIC_API_KEY=sk-ant-your_actual_anthropic_key

   # Default LLM provider (claude or openai)
   LLM_DEFAULT_PROVIDER=claude
   ```

#### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Yes | Your Spotify app's Client ID from the Developer Dashboard |
| `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` | Yes | Must match exactly what you registered in Spotify. Use `http://127.0.0.1:3000/api/auth/spotify/callback` for local development |
| `OPENAI_API_KEY` | One of these | Your OpenAI API key for GPT-4 based suggestions |
| `ANTHROPIC_API_KEY` | One of these | Your Anthropic API key for Claude-based suggestions |
| `LLM_DEFAULT_PROVIDER` | No | Default provider selection in the UI (`claude` or `openai`). Defaults to `claude` if not set |

### 5. Run the App

```bash
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.

> **Note**: Use `127.0.0.1` instead of `localhost` to ensure the Spotify OAuth redirect works correctly.

## Usage

1. **Log in with Spotify**: Click the "Log in with Spotify" button and authorize the app
2. **Enter a prompt**: Describe the kind of playlist you want (e.g., "relaxing jazz for a rainy afternoon")
3. **Select an LLM**: Choose Claude or OpenAI from the dropdown
4. **Generate suggestions**: Click "Suggest songs" to get AI-powered recommendations
5. **Build your playlist**: Check the songs you like and click "Add Selected" to add them to your playlist
6. **Create on Spotify**: Give your playlist a name and click "Create Playlist" to save it to your Spotify account

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Testing**: Jest + React Testing Library
- **APIs**: Spotify Web API, OpenAI API, Anthropic API

## Troubleshooting

### "Invalid redirect URI" error from Spotify
- Make sure the redirect URI in your `.env.local` exactly matches what you registered in the Spotify Developer Dashboard
- Use `127.0.0.1` instead of `localhost`

### Auth refresh fails on page load
- This is normal if you haven't logged in yet or your session expired
- Click "Log in with Spotify" to authenticate

### LLM API errors
- Verify your API key is correct and has available credits
- Check that you're using the correct provider (Claude vs OpenAI)

### Songs not found on Spotify
- Some songs suggested by the LLM may not be available on Spotify
- The app shows a match rate (e.g., "15 of 20 songs found") and marks unfound songs

## About Ralph

This project was built following the [Getting Started With Ralph](https://www.aihero.dev/getting-started-with-ralph) tutorial from AI Hero. Ralph is an autonomous AI agent loop technique that runs Claude Code repeatedly until all PRD (Product Requirements Document) items are complete.

## License

MIT
