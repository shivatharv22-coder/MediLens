import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 * The CSP is intentionally strict: no third-party script hosts are used.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    // Camera is required by the scanner, on this origin only.
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'tesseract.js'],
  outputFileTracingIncludes: {
    '/api/**': ['./database/data/**'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Never let a proxy or browser cache an API response containing user data.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
