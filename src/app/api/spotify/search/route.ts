/**
 * Spotify search API endpoint
 * Searches for multiple songs on Spotify with concurrency-limited parallel requests
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SpotifyClient,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyAPIError,
} from '@/lib/spotify/api';
import type { Song, SpotifySearchResult, SpotifySearchResponse } from '@/types';

/**
 * Maximum number of concurrent Spotify search requests
 * Keeps us within reasonable rate limits while still being efficient
 */
const MAX_CONCURRENCY = 5;

/**
 * Validates that the request body contains valid songs array
 */
function isValidSong(song: unknown): song is Song {
  if (typeof song !== 'object' || song === null) return false;
  const s = song as Record<string, unknown>;
  return typeof s.title === 'string' && s.title.length > 0 && typeof s.artist === 'string' && s.artist.length > 0;
}

/**
 * Executes async tasks with a concurrency limit
 * @param tasks - Array of async task functions
 * @param limit - Maximum concurrent executions
 * @returns Array of results in same order as tasks
 */
async function executeWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  async function executeNext(): Promise<void> {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      results[index] = await tasks[index]();
    }
  }

  // Start workers up to the concurrency limit
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => executeNext()
  );

  await Promise.all(workers);
  return results;
}

/**
 * POST /api/spotify/search
 * Searches for songs on Spotify
 *
 * Request body:
 * - songs: Song[] - Array of songs to search for
 * - accessToken: string - Spotify access token
 *
 * Response:
 * - results: SpotifySearchResult[] - Search results for each song
 * - matchRate: number - Percentage of songs found (0-100)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validate request body
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { error: 'Request body must be an object' },
      { status: 400 }
    );
  }

  const { songs, accessToken } = body as Record<string, unknown>;

  // Validate accessToken
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return NextResponse.json(
      { error: 'accessToken is required' },
      { status: 400 }
    );
  }

  // Validate songs array
  if (!Array.isArray(songs)) {
    return NextResponse.json(
      { error: 'songs must be an array' },
      { status: 400 }
    );
  }

  if (songs.length === 0) {
    return NextResponse.json(
      { error: 'songs array cannot be empty' },
      { status: 400 }
    );
  }

  // Validate each song
  const validSongs: Song[] = [];
  for (let i = 0; i < songs.length; i++) {
    if (!isValidSong(songs[i])) {
      return NextResponse.json(
        { error: `Invalid song at index ${i}: must have non-empty title and artist` },
        { status: 400 }
      );
    }
    validSongs.push(songs[i] as Song);
  }

  // Create Spotify client
  const spotifyClient = new SpotifyClient(accessToken);

  // Create search tasks for each song
  const searchTasks = validSongs.map((song) => async (): Promise<SpotifySearchResult> => {
    const spotifyTrack = await spotifyClient.searchTrack(song.title, song.artist);
    return {
      song,
      spotifyTrack,
    };
  });

  try {
    // Execute searches with concurrency limit
    const results = await executeWithConcurrency(searchTasks, MAX_CONCURRENCY);

    // Calculate match rate
    const matchedCount = results.filter((r) => r.spotifyTrack !== null).length;
    const matchRate = results.length > 0 ? (matchedCount / results.length) * 100 : 0;

    const response: SpotifySearchResponse = {
      results,
      matchRate,
    };

    return NextResponse.json(response);
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
    console.error('Unexpected error in /api/spotify/search:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
