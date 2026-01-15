/**
 * Spotify playlist tracks API endpoint
 * Fetches tracks from a specific playlist
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SpotifyClient,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyAPIError,
} from '@/lib/spotify/api';
import type { SpotifyTrack } from '@/types';

interface RouteParams {
  params: Promise<{ playlistId: string }>;
}

/**
 * GET /api/spotify/playlists/[playlistId]/tracks
 * Fetches tracks from a specific Spotify playlist
 *
 * Query params:
 * - accessToken: string - Spotify access token (required)
 * - limit: number - Maximum tracks to fetch (optional, default 100)
 *
 * Response:
 * - tracks: SpotifyTrack[] - Array of tracks in the playlist
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { playlistId } = await params;
  const searchParams = request.nextUrl.searchParams;

  // Validate playlist ID
  if (!playlistId) {
    return NextResponse.json(
      { error: 'playlistId is required' },
      { status: 400 }
    );
  }

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
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  if (isNaN(limit) || limit < 1) {
    return NextResponse.json(
      { error: 'limit must be a positive number' },
      { status: 400 }
    );
  }

  // Create Spotify client
  const spotifyClient = new SpotifyClient(accessToken);

  try {
    // Fetch playlist tracks
    const tracks: SpotifyTrack[] = await spotifyClient.getPlaylistTracks(
      playlistId,
      limit
    );

    return NextResponse.json({ tracks });
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
    console.error(
      `Unexpected error in /api/spotify/playlists/${playlistId}/tracks:`,
      error
    );
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
