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
      bodySizeLimit: '20mb',
      allowedOrigins: [
        "*.cloudworkstations.dev",
        "localhost:3000",
        "localhost:9002",
        "*.firebasestorage.app"
      ]
    }
  },

  // 🔐 Server Infrastructure Hardening
  // Prevents Next.js from bundling Genkit's node-native and telemetry dependencies
  serverExternalPackages: [
    'genkit', 
    '@genkit-ai/google-genai', 
    '@genkit-ai/core', 
    '@genkit-ai/dotprompt', 
    '@genkit-ai/flow',
    '@opentelemetry/sdk-node',
    '@opentelemetry/instrumentation'
  ],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'vucefokfhdrbgldrimgl.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
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