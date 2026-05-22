import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RentalFlow',
    short_name: 'RentalFlow',
    description: 'Professional Rental Management & Maintenance',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1e3a8a',
    icons: [
      {
        src: 'https://images.unsplash.com/photo-1448630360428-65ff265eb4e2?q=80&w=192&h=192&auto=format&fit=crop',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://images.unsplash.com/photo-1448630360428-65ff265eb4e2?q=80&w=512&h=512&auto=format&fit=crop',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
