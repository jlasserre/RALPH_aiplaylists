/**
 * Streaming Spotify search API endpoint
 * Searches for songs on Spotify and returns results incrementally via Server-Sent Events (SSE)
 */

import { NextRequest } from 'next/server';
import {
  SpotifyClient,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyAPIError,
} from '@/lib/spotify/api';
import type { Song, SpotifySearchResult } from '@/types';

/**
 * Maximum number of concurrent Spotify search requests
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
 * POST /api/spotify/search/stream
 * Searches for songs on Spotify and streams results via SSE
 *
 * Request body:
 * - songs: Song[] - Array of songs to search for
 * - accessToken: string - Spotify access token
 *
 * SSE events:
 * - result: { index: number, result: SpotifySearchResult } - Individual search result
 * - complete: { matchRate: number } - Search complete with final match rate
 * - error: { message: string, code: string } - Error occurred
 */
export async function POST(request: NextRequest): Promise<Response> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate request body
  if (typeof body !== 'object' || body === null) {
    return new Response(
      JSON.stringify({ error: 'Request body must be an object' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { songs, accessToken } = body as Record<string, unknown>;

  // Validate accessToken
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return new Response(
      JSON.stringify({ error: 'accessToken is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate songs array
  if (!Array.isArray(songs)) {
    return new Response(
      JSON.stringify({ error: 'songs must be an array' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (songs.length === 0) {
    return new Response(
      JSON.stringify({ error: 'songs array cannot be empty' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate each song
  const validSongs: Song[] = [];
  for (let i = 0; i < songs.length; i++) {
    if (!isValidSong(songs[i])) {
      return new Response(
        JSON.stringify({ error: `Invalid song at index ${i}: must have non-empty title and artist` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    validSongs.push(songs[i] as Song);
  }

  // Create Spotify client
  const spotifyClient = new SpotifyClient(accessToken);

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let matchedCount = 0;
      let completedCount = 0;
      let hasError = false;

      // Function to send SSE event
      const sendEvent = (eventType: string, data: unknown) => {
        const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Track active searches to respect concurrency limit
      const pendingSearches: Array<{ index: number; song: Song }> = validSongs.map((song, index) => ({ index, song }));
      const activeSearches = new Set<number>();

      // Function to start a search if under concurrency limit
      const startNextSearch = async () => {
        if (activeSearches.size >= MAX_CONCURRENCY || pendingSearches.length === 0 || hasError) {
          return;
        }

        const { index, song } = pendingSearches.shift()!;
        activeSearches.add(index);

        try {
          const spotifyTrack = await spotifyClient.searchTrack(song.title, song.artist);

          if (hasError) return; // Abort if error occurred in another search

          const result: SpotifySearchResult = {
            song,
            spotifyTrack,
          };

          if (spotifyTrack !== null) {
            matchedCount++;
          }

          sendEvent('result', { index, result });
          completedCount++;
          activeSearches.delete(index);

          // Check if all done
          if (completedCount === validSongs.length) {
            const matchRate = validSongs.length > 0 ? (matchedCount / validSongs.length) * 100 : 0;
            sendEvent('complete', { matchRate });
            controller.close();
          } else {
            // Start next searches (fill up to concurrency limit)
            while (activeSearches.size < MAX_CONCURRENCY && pendingSearches.length > 0 && !hasError) {
              startNextSearch();
            }
          }
        } catch (error) {
          if (hasError) return; // Already handling an error
          hasError = true;

          let errorData: { message: string; code: string; retryAfter?: number };

          if (error instanceof SpotifyAuthError) {
            errorData = { message: error.message, code: 'AUTH_ERROR' };
          } else if (error instanceof SpotifyRateLimitError) {
            errorData = { message: error.message, code: 'RATE_LIMIT', retryAfter: error.retryAfter ?? undefined };
          } else if (error instanceof SpotifyAPIError) {
            errorData = { message: error.message, code: 'SPOTIFY_ERROR' };
          } else {
            errorData = { message: 'An unexpected error occurred', code: 'UNKNOWN_ERROR' };
          }

          sendEvent('error', errorData);
          controller.close();
        }
      };

      // Start initial batch of searches up to concurrency limit
      const initialBatch = Math.min(MAX_CONCURRENCY, pendingSearches.length);
      for (let i = 0; i < initialBatch; i++) {
        startNextSearch();
      }
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
