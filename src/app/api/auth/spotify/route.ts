import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateRandomState,
} from '@/lib/spotify/auth';

/**
 * Spotify OAuth scopes required for the application:
 * - playlist-read-private: Read user's private playlists
 * - playlist-modify-public: Create/modify public playlists
 * - playlist-modify-private: Create/modify private playlists
 */
const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';

/**
 * GET /api/auth/spotify
 *
 * Initiates the Spotify OAuth PKCE flow by:
 * 1. Generating a code verifier and storing it in an httpOnly cookie
 * 2. Generating a code challenge from the verifier
 * 3. Generating a random state for CSRF protection
 * 4. Redirecting to Spotify's authorization endpoint
 */
export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Spotify client ID not configured' },
      { status: 500 }
    );
  }

  if (!redirectUri) {
    return NextResponse.json(
      { error: 'Spotify redirect URI not configured' },
      { status: 500 }
    );
  }

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomState();

  // Build Spotify authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state: state,
    scope: SPOTIFY_SCOPES,
  });

  const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`;

  // Store code verifier and state in httpOnly cookies for callback verification
  const cookieStore = await cookies();

  // Code verifier cookie - needed for token exchange in callback
  cookieStore.set('spotify_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes - enough time for user to complete auth
    path: '/',
  });

  // State cookie - needed for CSRF validation in callback
  cookieStore.set('spotify_auth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Redirect to Spotify authorization page
  return NextResponse.redirect(authUrl);
}
