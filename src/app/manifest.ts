import { MetadataRoute } from 'next'

/**
 * 📱 Web App Manifest Configuration
 * Optimized for high-fidelity Android and iOS "Add to Home Screen" experiences.
 */
export default function manifest(): MetadataRoute.Manifest {
  const LOGO_URL = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=512&h=512&auto=format&fit=crop";

  return {
    name: 'RentalFlow | Premium Portfolio Management',
    short_name: 'RentalFlow',
    description: 'Professional Rental Management & AI-Driven Maintenance',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e3a8a',
    icons: [
      {
        src: LOGO_URL,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: LOGO_URL,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
