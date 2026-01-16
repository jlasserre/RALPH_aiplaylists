import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, LLMProvider, ClaudeAPIError, OpenAIAPIError } from '@/lib/llm';
import { Song } from '@/types/song';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

/**
 * Request body for song generation
 */
interface GenerateRequest {
  prompt: string;
  provider: LLMProvider;
}

/**
 * Response body for song generation
 */
interface GenerateResponse {
  songs: Song[];
}

/**
 * Error response body
 */
interface ErrorResponse {
  error: string;
  isRetryable?: boolean;
}

/**
 * Minimum prompt length (characters)
 */
const MIN_PROMPT_LENGTH = 10;

/**
 * Maximum prompt length (characters)
 */
const MAX_PROMPT_LENGTH = 5000;

/**
 * Valid LLM providers
 */
const VALID_PROVIDERS: LLMProvider[] = ['claude', 'openai'];

/**
 * POST /api/generate
 *
 * Generates song suggestions using the specified LLM provider.
 *
 * Request body:
 * - prompt: string (10-5000 characters) - Description of desired songs
 * - provider: 'claude' | 'openai' - LLM provider to use
 *
 * Response:
 * - songs: Song[] - Array of generated song suggestions
 */
export async function POST(request: NextRequest): Promise<NextResponse<GenerateResponse | ErrorResponse>> {
  // Apply rate limiting (10 requests per minute per session)
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.generate, 'generate');
  if (!rateLimitResult.success) {
    return rateLimitResult.response as NextResponse<ErrorResponse>;
  }

  try {
    // Parse request body
    let body: GenerateRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { prompt, provider } = body;

    // Validate prompt exists
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate prompt length
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < MIN_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt must be at least ${MIN_PROMPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt must not exceed ${MAX_PROMPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Validate provider
    if (!provider || typeof provider !== 'string') {
      return NextResponse.json(
        { error: 'Provider is required and must be a string' },
        { status: 400 }
      );
    }

    if (!VALID_PROVIDERS.includes(provider as LLMProvider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get LLM client and generate songs
    const client = getLLMClient(provider as LLMProvider);
    const songs = await client.generateSongs(trimmedPrompt);

    return NextResponse.json({ songs });
  } catch (error) {
    // Handle LLM-specific errors
    if (error instanceof ClaudeAPIError || error instanceof OpenAIAPIError) {
      console.error(`LLM API error (${error.name}):`, error.message);

      // Determine appropriate status code
      const statusCode = error.statusCode || 500;

      // Map common status codes
      if (statusCode === 401) {
        return NextResponse.json(
          { error: 'LLM authentication failed. Please check API configuration.', isRetryable: false },
          { status: 500 } // Return 500 to client as this is a server config issue
        );
      }

      if (statusCode === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.', isRetryable: true },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: error.message, isRetryable: error.isRetryable },
        { status: statusCode >= 500 ? 502 : 500 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in /api/generate:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating songs', isRetryable: true },
      { status: 500 }
    );
  }
}
