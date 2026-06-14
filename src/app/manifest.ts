import { MetadataRoute } from 'next'

/**
 * 📱 High-Fidelity Web App Manifest
 * Optimized for Google Play Store (Trusted Web Activity) and iOS Standalone.
 * Includes mandatory ID and SCOPE identifiers for secure app store wrapping.
 */
export default function manifest(): MetadataRoute.Manifest {
  const LOGO_URL = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=512&h=512&auto=format&fit=crop";

  return {
    name: 'RentalFlow | Premium Portfolio Management',
    short_name: 'RentalFlow',
    description: 'Professional property management with AI-driven maintenance and high-fidelity visual ledgers.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'portrait',
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
    shortcuts: [
      {
        name: 'Report Maintenance',
        url: '/tenant/maintenance',
        description: 'Open the AI Diagnostic Hub',
      },
      {
        name: 'My Properties',
        url: '/landlord/properties',
        description: 'View active portfolio inventory',
      }
    ],
    screenshots: [
      {
        src: 'https://picsum.photos/seed/rf1/1280/720',
        sizes: '1280x720',
        type: 'image/jpeg',
        label: 'Commander Hub Overview'
      }
    ]
  }
}
