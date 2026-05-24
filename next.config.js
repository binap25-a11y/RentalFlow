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
      bodySizeLimit: '50mb',
      allowedOrigins: [
        "*.cloudworkstations.dev",
        "localhost:3000",
        "localhost:9002",
        "*.firebasestorage.app",
        "*.ngrok-free.app",
        "*.loca.lt",
        "*.supabase.co",
        "*.branch.io",
        "*.vercel.app"
      ]
    }
  },

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
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'vucefokfhdrbgldrimgl.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.firebasestorage.app', pathname: '/**' },
    ],
  },
};

module.exports = nextConfig;
