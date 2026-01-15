import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string; // Spotify may return a new refresh token
}

interface SpotifyErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * POST /api/auth/refresh
 *
 * Retrieves or refreshes the Spotify access token:
 * 1. First checks if there's a fresh access_token cookie (from OAuth callback)
 * 2. If not, uses the refresh_token to obtain a new access_token from Spotify
 * 3. Returns the access_token in JSON response for client-side storage
 */
export async function POST() {
  const cookieStore = await cookies();

  // Check for existing access token cookie (from recent OAuth callback)
  const existingAccessToken = cookieStore.get('spotify_access_token')?.value;
  if (existingAccessToken) {
    // Return the existing token - client will store it in memory
    // The cookie will naturally expire based on its maxAge
    return NextResponse.json({
      access_token: existingAccessToken,
    });
  }

  // No access token cookie - need to use refresh token
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token available' },
      { status: 401 }
    );
  }

  // Get client ID for token refresh
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;

  if (!clientId) {
    console.error('Missing Spotify client ID');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // Request new access token using refresh token
  try {
    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData: SpotifyErrorResponse = await tokenResponse.json();
      console.error('Spotify token refresh failed:', errorData);

      // If refresh token is invalid/expired, clear it and return 401
      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        const response = NextResponse.json(
          { error: 'Refresh token expired or invalid' },
          { status: 401 }
        );
        response.cookies.delete('spotify_refresh_token');
        return response;
      }

      return NextResponse.json(
        { error: errorData.error_description || 'Token refresh failed' },
        { status: tokenResponse.status }
      );
    }

    const tokenData: SpotifyTokenResponse = await tokenResponse.json();

    // Create response with new access token
    const response = NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    });

    // If Spotify returned a new refresh token, update the cookie
    if (tokenData.refresh_token) {
      response.cookies.set('spotify_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    return response;
  } catch (err) {
    console.error('Error during token refresh:', err);
    return NextResponse.json(
      { error: 'Network error during token refresh' },
      { status: 500 }
    );
  }
}
