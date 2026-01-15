/**
 * Spotify playlist API endpoint
 * Handles creating new playlists and updating existing ones
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  SpotifyClient,
  SpotifyAuthError,
  SpotifyRateLimitError,
  SpotifyAPIError,
} from '@/lib/spotify/api';
import type { PlaylistCreateResponse } from '@/types';

/**
 * Maximum number of tracks that can be added/removed in a single request
 * Spotify API limit is 100 per request
 */
const MAX_TRACKS_PER_REQUEST = 100;

/**
 * Validates that a value is a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validates that a value is an array of non-empty strings
 */
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  );
}

/**
 * Validates that a URI is a valid Spotify track URI
 * Format: spotify:track:TRACKID
 */
function isValidSpotifyUri(uri: string): boolean {
  return /^spotify:track:[a-zA-Z0-9]+$/.test(uri);
}

/**
 * Handles Spotify-specific errors and returns appropriate responses
 */
function handleSpotifyError(error: unknown): NextResponse {
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
  console.error('Unexpected error in /api/spotify/playlist:', error);
  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  );
}

/**
 * Adds tracks to playlist in batches (max 100 per request)
 */
async function addTracksInBatches(
  client: SpotifyClient,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  for (let i = 0; i < trackUris.length; i += MAX_TRACKS_PER_REQUEST) {
    const batch = trackUris.slice(i, i + MAX_TRACKS_PER_REQUEST);
    await client.addTracksToPlaylist(playlistId, batch);
  }
}

/**
 * Removes tracks from playlist in batches (max 100 per request)
 */
async function removeTracksInBatches(
  client: SpotifyClient,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  for (let i = 0; i < trackUris.length; i += MAX_TRACKS_PER_REQUEST) {
    const batch = trackUris.slice(i, i + MAX_TRACKS_PER_REQUEST);
    await client.removeTracksFromPlaylist(playlistId, batch);
  }
}

/**
 * POST /api/spotify/playlist
 * Creates a new Spotify playlist with the given tracks
 *
 * Request body:
 * - name: string - Playlist name (1-100 characters)
 * - trackUris: string[] - Array of Spotify track URIs
 * - accessToken: string - Spotify access token
 * - description?: string - Optional playlist description (max 300 chars)
 *
 * Response:
 * - playlistId: string - The created playlist's Spotify ID
 * - playlistUrl: string - URL to the playlist on Spotify
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

  const { name, trackUris, accessToken, description } = body as Record<string, unknown>;

  // Validate accessToken
  if (!isNonEmptyString(accessToken)) {
    return NextResponse.json(
      { error: 'accessToken is required' },
      { status: 400 }
    );
  }

  // Validate name (1-100 chars per Spotify limits)
  if (!isNonEmptyString(name)) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  if (name.length > 100) {
    return NextResponse.json(
      { error: 'name must be 100 characters or less' },
      { status: 400 }
    );
  }

  // Validate description if provided (max 300 chars per Spotify limits)
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description must be a string' },
        { status: 400 }
      );
    }
    if (description.length > 300) {
      return NextResponse.json(
        { error: 'description must be 300 characters or less' },
        { status: 400 }
      );
    }
  }

  // Validate trackUris
  if (!isStringArray(trackUris)) {
    return NextResponse.json(
      { error: 'trackUris must be an array of strings' },
      { status: 400 }
    );
  }

  // Validate each URI format
  for (let i = 0; i < trackUris.length; i++) {
    if (!isValidSpotifyUri(trackUris[i])) {
      return NextResponse.json(
        { error: `Invalid Spotify URI at index ${i}: ${trackUris[i]}` },
        { status: 400 }
      );
    }
  }

  try {
    const spotifyClient = new SpotifyClient(accessToken);

    // Get the current user's ID
    const user = await spotifyClient.getCurrentUser();

    // Create the playlist
    const playlist = await spotifyClient.createPlaylist(
      user.id,
      name,
      typeof description === 'string' ? description : undefined
    );

    // Add tracks to the playlist (in batches if necessary)
    if (trackUris.length > 0) {
      await addTracksInBatches(spotifyClient, playlist.id, trackUris);
    }

    const response: PlaylistCreateResponse = {
      playlistId: playlist.id,
      playlistUrl: playlist.external_urls.spotify,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleSpotifyError(error);
  }
}

/**
 * PUT /api/spotify/playlist
 * Updates an existing Spotify playlist (add and/or remove tracks)
 *
 * Request body:
 * - playlistId: string - Spotify playlist ID
 * - addUris?: string[] - Array of Spotify track URIs to add
 * - removeUris?: string[] - Array of Spotify track URIs to remove
 * - accessToken: string - Spotify access token
 *
 * Response:
 * - playlistId: string - The playlist's Spotify ID
 * - playlistUrl: string - URL to the playlist on Spotify
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
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

  const { playlistId, addUris, removeUris, accessToken } = body as Record<string, unknown>;

  // Validate accessToken
  if (!isNonEmptyString(accessToken)) {
    return NextResponse.json(
      { error: 'accessToken is required' },
      { status: 400 }
    );
  }

  // Validate playlistId
  if (!isNonEmptyString(playlistId)) {
    return NextResponse.json(
      { error: 'playlistId is required' },
      { status: 400 }
    );
  }

  // Validate addUris if provided
  if (addUris !== undefined && addUris !== null) {
    if (!isStringArray(addUris)) {
      return NextResponse.json(
        { error: 'addUris must be an array of strings' },
        { status: 400 }
      );
    }
    for (let i = 0; i < addUris.length; i++) {
      if (!isValidSpotifyUri(addUris[i])) {
        return NextResponse.json(
          { error: `Invalid Spotify URI in addUris at index ${i}: ${addUris[i]}` },
          { status: 400 }
        );
      }
    }
  }

  // Validate removeUris if provided
  if (removeUris !== undefined && removeUris !== null) {
    if (!isStringArray(removeUris)) {
      return NextResponse.json(
        { error: 'removeUris must be an array of strings' },
        { status: 400 }
      );
    }
    for (let i = 0; i < removeUris.length; i++) {
      if (!isValidSpotifyUri(removeUris[i])) {
        return NextResponse.json(
          { error: `Invalid Spotify URI in removeUris at index ${i}: ${removeUris[i]}` },
          { status: 400 }
        );
      }
    }
  }

  // Require at least one of addUris or removeUris
  const hasAddUris = Array.isArray(addUris) && addUris.length > 0;
  const hasRemoveUris = Array.isArray(removeUris) && removeUris.length > 0;

  if (!hasAddUris && !hasRemoveUris) {
    return NextResponse.json(
      { error: 'At least one of addUris or removeUris must be provided with tracks' },
      { status: 400 }
    );
  }

  try {
    const spotifyClient = new SpotifyClient(accessToken);

    // Remove tracks first (if any), then add tracks
    // This order ensures we don't accidentally add then immediately remove
    if (hasRemoveUris) {
      await removeTracksInBatches(spotifyClient, playlistId, removeUris as string[]);
    }

    if (hasAddUris) {
      await addTracksInBatches(spotifyClient, playlistId, addUris as string[]);
    }

    // Construct the playlist URL
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;

    const response: PlaylistCreateResponse = {
      playlistId,
      playlistUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleSpotifyError(error);
  }
}
