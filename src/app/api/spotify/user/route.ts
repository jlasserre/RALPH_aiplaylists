import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

/**
 * GET /api/spotify/user
 * Fetches the current user's Spotify profile
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting (100 requests per minute per IP)
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.general, 'general');
  if (!rateLimitResult.success) {
    return rateLimitResult.response;
  }

  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get('accessToken');

  if (!accessToken) {
    return NextResponse.json(
      { message: 'Access token is required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: error.error?.message || 'Failed to fetch user profile' },
        { status: response.status }
      );
    }

    const userData = await response.json();

    // Return only the fields we need
    return NextResponse.json({
      id: userData.id,
      display_name: userData.display_name,
      email: userData.email,
      images: userData.images,
      product: userData.product,
      country: userData.country,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
