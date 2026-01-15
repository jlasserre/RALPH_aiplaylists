/**
 * Spotify playlists API endpoint
 * Fetches the current user's playlists from Spotify
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SpotifyClient,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyAPIError,
} from '@/lib/spotify/api';
import type { UserPlaylist } from '@/types';

/**
 * GET /api/spotify/playlists
 * Fetches the current user's Spotify playlists
 *
 * Query params:
 * - accessToken: string - Spotify access token (required)
 * - limit: number - Maximum playlists to fetch (optional, default 50)
 *
 * Response:
 * - playlists: UserPlaylist[] - Array of user playlists with ownership info
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  // Get access token from query params
  const accessToken = searchParams.get('accessToken');
  if (!accessToken) {
    return NextResponse.json(
      { error: 'accessToken is required' },
      { status: 400 }
    );
  }

  // Get optional limit param
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  if (isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { error: 'limit must be a positive number' },
      { status: 400 }
    );
  }

  // Create Spotify client
  const spotifyClient = new SpotifyClient(accessToken);

  try {
    // Fetch user playlists
    const playlists: UserPlaylist[] = await spotifyClient.getUserPlaylists(limit);

    return NextResponse.json({ playlists });
  } catch (error) {
    // Handle Spotify-specific errors
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json(
        { error: error.message, code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    if (error instanceof SpotifyRateLimitError) {
      const headers: Record<string, string> = {};
      if (error.retryAfter !== null) {
        headers['Retry-After'] = error.retryAfter.toString();
      }
      return NextResponse.json(
        { error: error.message, code: 'RATE_LIMIT', retryAfter: error.retryAfter },
        { status: 429, headers }
      );
    }

    if (error instanceof SpotifyAPIError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'SPOTIFY_ERROR',
          isRetryable: error.isRetryable,
        },
        { status: error.statusCode >= 500 ? 502 : error.statusCode }
      );
    }

    // Unknown error
    console.error('Unexpected error in /api/spotify/playlists:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
