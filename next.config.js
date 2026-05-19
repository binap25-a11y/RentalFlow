/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        "3000-firebase-leaseloop-4-1779055012886.cluster-cbeiita7rbe7iuwhvjs5zww2i4.cloudworkstations.dev",
        "6000-firebase-leaseloop-4-1779055012886.cluster-cbeiita7rbe7iuwhvjs5zww2i4.cloudworkstations.dev",
        "9002-firebase-leaseloop-4-1779055012886.cluster-cbeiita7rbe7iuwhvjs5zww2i4.cloudworkstations.dev"
      ]
    }
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;