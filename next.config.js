/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  experimental: {
    forceSwcTransforms: true,
  },
  webpack(config, { isServer }) {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  // Disable TypeScript build errors in production
  typescript: {
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig; 