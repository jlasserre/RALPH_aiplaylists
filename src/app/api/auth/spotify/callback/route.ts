import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateCSRFToken, setCSRFCookies } from '@/lib/csrf';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
}

interface SpotifyErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * GET /api/auth/spotify/callback
 *
 * Handles the Spotify OAuth callback after user authorization:
 * 1. Validates the state parameter for CSRF protection
 * 2. Exchanges the authorization code for tokens using PKCE
 * 3. Stores the refresh token in an httpOnly cookie
 * 4. Redirects to home page with success indicator
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle error from Spotify (user denied access, etc.)
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Authorization failed';
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=missing_code', request.url)
    );
  }

  if (!state) {
    return NextResponse.redirect(
      new URL('/?error=missing_state', request.url)
    );
  }

  // Retrieve stored values from cookies
  const cookieStore = await cookies();
  const storedState = cookieStore.get('spotify_auth_state')?.value;
  const codeVerifier = cookieStore.get('spotify_code_verifier')?.value;

  // Validate state for CSRF protection
  if (!storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL('/?error=invalid_state', request.url)
    );
  }

  // Validate code verifier exists
  if (!codeVerifier) {
    return NextResponse.redirect(
      new URL('/?error=missing_verifier', request.url)
    );
  }

  // Get environment variables
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL('/?error=server_configuration', request.url)
    );
  }

  // Exchange authorization code for tokens
  try {
    const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData: SpotifyErrorResponse = await tokenResponse.json();
      console.error('Spotify token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(errorData.error_description || 'token_exchange_failed')}`, request.url)
      );
    }

    const tokenData: SpotifyTokenResponse = await tokenResponse.json();

    // Create response with redirect
    // Use the redirect URI's origin to ensure cookie domain matches
    const redirectOrigin = new URL(redirectUri).origin;
    const response = NextResponse.redirect(
      new URL('/?auth=success', redirectOrigin)
    );

    // Store refresh token in httpOnly cookie
    response.cookies.set('spotify_refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Store access token in httpOnly cookie for initial page load
    // This will be read by /api/auth/refresh and then cleared
    response.cookies.set('spotify_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in, // Usually ~1 hour
      path: '/',
    });

    // Clear the temporary auth cookies
    response.cookies.delete('spotify_auth_state');
    response.cookies.delete('spotify_code_verifier');

    // Generate and set CSRF token for write endpoint protection
    const csrfToken = generateCSRFToken();
    setCSRFCookies(csrfToken, response);

    return response;
  } catch (err) {
    console.error('Error during token exchange:', err);
    return NextResponse.redirect(
      new URL('/?error=token_exchange_error', request.url)
    );
  }
}
