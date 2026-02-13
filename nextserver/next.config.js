/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for deployment
  output: 'standalone',

  // Disable image optimization (no frontend)
  images: {
    unoptimized: true,
  },

  // API-only optimizations
  experimental: {
    // Reduce bundle size
    optimizePackageImports: ['zod'],
  },

  // Headers for CORS (backup to middleware)
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Override in middleware
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
