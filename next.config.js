const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true, // Modern SWC minification is generally more memory-efficient than Terser
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
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
