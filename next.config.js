const path = require('path')

// Deliberately permissive on script/style-src (no nonce plumbing exists yet, and this
// app relies on inline styles/scripts in several places) — the goal here is closing the
// clickjacking gap (frame-ancestors) and the other low-risk/high-value directives
// (object-src, base-uri, form-action) without risking breakage of legitimate
// functionality that can't be fully exercised in this environment (no live browser pass).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.evetech.net https://images.evetools.dev",
  "font-src 'self' data:",
  "connect-src 'self' https://esi.evetech.net",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
  swcMinify: true, // Modern SWC minification is generally more memory-efficient than Terser
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@xyflow/react'],
    cpus: 1,
    workerThreads: false,
    webpackBuildWorker: false,
  },
  transpilePackages: ['framer-motion'],
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.evetech.net',
      },
      {
        protocol: 'https',
        hostname: 'images.evetools.dev',
      },
    ],
  },
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },
}

module.exports = nextConfig
