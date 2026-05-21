import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Hardened Asset Resolution Engine
 * Strictly prioritizes user-uploaded content over placeholders.
 * Tier 1: Explicit primary imageUrl (Designated Cover)
 * Tier 2: First item in the gallery ledger (imageUrls[0])
 * Tier 3: Professional platform fallback
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  const FALLBACK = "https://picsum.photos/seed/rentalflow-default/800/600";
  
  // 1. Check designated cover image
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== "" && imageUrl.startsWith('http')) {
    // Only return if it's not a generic picsum placeholder that might have been saved
    if (!imageUrl.includes('picsum.photos/seed/prop')) {
      return imageUrl;
    }
  }
  
  // 2. Fallback to the first item in the gallery ledger
  if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
    const firstUrl = imageUrls[0];
    if (firstUrl && typeof firstUrl === 'string' && firstUrl.trim() !== "" && firstUrl.startsWith('http')) {
      return firstUrl;
    }
  }
  
  // 3. Absolute fallback
  return FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Reconstructs the full visual stack ensuring the cover is always at Index 0.
 * Deduplicates and filters for valid, non-empty URLs.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const FALLBACK = "https://picsum.photos/seed/rentalflow-default/800/600";
  const gallery: string[] = [];

  // 1. Seed with the primary cover
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== "" && imageUrl.startsWith('http')) {
    gallery.push(imageUrl);
  }

  // 2. Add remaining unique assets from the ledger
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.trim() !== "" && url.startsWith('http') && !gallery.includes(url)) {
        gallery.push(url);
      }
    });
  }

  return gallery.length > 0 ? gallery : [FALLBACK];
}
