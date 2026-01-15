import { NextRequest, NextResponse } from 'next/server';
import { SpotifyClient, SpotifyAuthError, SpotifyRateLimitError, SpotifyAPIError } from '@/lib/spotify/api';
import { SpotifyTrack } from '@/types';

/**
 * POST /api/spotify/recommendations
 * Get song recommendations based on a seed track.
 *
 * Request body:
 * - seedTrackId: string - Spotify track ID to use as seed
 * - accessToken: string - Spotify access token
 * - limit?: number - Number of recommendations (default 10, max 100)
 *
 * Response:
 * - tracks: SpotifyTrack[] - Array of recommended tracks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { seedTrackId, accessToken, limit = 10 } = body;

    // Validate required fields
    if (!seedTrackId || typeof seedTrackId !== 'string') {
      return NextResponse.json(
        { error: 'seedTrackId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { error: 'accessToken is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate limit
    const parsedLimit = typeof limit === 'number' ? limit : parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return NextResponse.json(
        { error: 'limit must be a number between 1 and 100' },
        { status: 400 }
      );
    }

    // Get recommendations from Spotify
    const client = new SpotifyClient(accessToken);
    const tracks: SpotifyTrack[] = await client.getRecommendations(seedTrackId, parsedLimit);

    return NextResponse.json({ tracks });
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json(
        { error: 'Spotify authentication failed. Please log in again.' },
        { status: 401 }
      );
    }

    if (error instanceof SpotifyRateLimitError) {
      return NextResponse.json(
        { error: 'Spotify rate limit exceeded. Please try again later.', retryAfter: error.retryAfter },
        { status: 429 }
      );
    }

    if (error instanceof SpotifyAPIError) {
      return NextResponse.json(
        { error: `Spotify API error: ${error.message}` },
        { status: error.statusCode || 500 }
      );
    }

    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}
