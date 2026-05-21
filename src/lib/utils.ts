import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Hardened Asset Resolution Engine
 * Ensures user-provided URLs are strictly prioritized over placeholders.
 */
export function getResolvedImageUrl(imageUrl: string | undefined, imageUrls: string[] | undefined): string {
  const FALLBACK = "https://picsum.photos/seed/prop1/800/600";
  
  // 1. Primary: The designated cover image
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // 2. Secondary: The first item in the gallery ledger
  if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
    const firstUrl = imageUrls[0];
    if (firstUrl && typeof firstUrl === 'string' && firstUrl.startsWith('http')) {
      return firstUrl;
    }
  }
  
  return FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Orders the gallery starting with the primary cover and deduplicates.
 */
export function getResolvedGallery(imageUrl: string | undefined, imageUrls: string[] | undefined): string[] {
  const FALLBACK = "https://picsum.photos/seed/prop1/800/600";
  const gallery: string[] = [];

  // 1. Prioritize primary cover
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
    gallery.push(imageUrl);
  }

  // 2. Add other unique images
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.startsWith('http') && !gallery.includes(url)) {
        gallery.push(url);
      }
    });
  }

  return gallery.length > 0 ? gallery : [FALLBACK];
}
