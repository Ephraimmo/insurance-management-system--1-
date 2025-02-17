/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Add error handling for environment variables
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Important: return the modified config
    return config;
  },
}

module.exports = nextConfig; 