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
        "localhost:9002",
        "127.0.0.1:9002",
        "*.cloudworkstations.dev",
        "*.ngrok-free.app",
        "*.loca.lt",
        "*.vercel.app",
        "*.web.app",
        "*.firebaseapp.com"
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
      { protocol: 'https', hostname: 'wgezhbkkhamaawxgcqjf.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.firebasestorage.app', pathname: '/**' },
    ],
  },
};

module.exports = nextConfig;
