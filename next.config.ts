import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              // Restrict script sources to self only
              "default-src 'self'",
              // Scripts only from self, with unsafe-inline for Next.js
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles from self with inline styles for Tailwind
              "style-src 'self' 'unsafe-inline'",
              // Images from self and Spotify CDN (for album art and user avatars)
              "img-src 'self' https://i.scdn.co https://image-cdn-ak.spotifycdn.com https://image-cdn-fa.spotifycdn.com data: blob:",
              // Fonts from self
              "font-src 'self'",
              // Connect to self, Spotify API, and LLM APIs
              "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://api.anthropic.com https://api.openai.com",
              // Forms only to self
              "form-action 'self'",
              // Frame ancestors none (equivalent to X-Frame-Options: DENY)
              "frame-ancestors 'none'",
              // Base URI restricted to self
              "base-uri 'self'",
            ].join("; "),
          },
          {
            // Prevent clickjacking
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Prevent MIME type sniffing
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Enable XSS protection in older browsers
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            // Control referrer information
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Enforce HTTPS (let browser remember for 1 year)
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            // Permissions policy - disable unnecessary features
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
