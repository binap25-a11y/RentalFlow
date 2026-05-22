import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Constants for Visual Fallbacks
 */
export const RENTALFLOW_FALLBACK = "https://picsum.photos/seed/rentalflow-default/800/600";

/**
 * 🖼️ Asset Validation Engine
 * Distinguishes between professional user uploads and platform placeholders.
 */
export function isValidAssetUrl(url: any): boolean {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  
  // Exclude specific platform fallbacks to ensure they don't block user content
  const isFallback = url.includes('picsum.photos/seed/rentalflow-default') || 
                    url.includes('placehold.co');
                    
  return !isFallback;
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * Strictly prioritizes user-uploaded content over placeholders.
 * Tier 1: Explicit primary imageUrl (Designated User Cover)
 * Tier 2: First valid item in the gallery ledger (imageUrls[0])
 * Tier 3: Professional platform fallback
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // 1. Prioritize explicit cover if it's a valid user upload
  if (isValidAssetUrl(imageUrl)) {
    return imageUrl!;
  }
  
  // 2. Fallback to the first valid item in the gallery ledger
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(isValidAssetUrl);
    if (firstUserUrl) return firstUserUrl;
  }
  
  // 3. Absolute system fallback
  return RENTALFLOW_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Reconstructs the full visual stack ensuring the cover is always at Index 0.
 * Deduplicates and filters for valid, non-empty URLs.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const gallery = new Set<string>();

  // 1. Seed with the primary cover if it's a real user upload
  if (isValidAssetUrl(imageUrl)) {
    gallery.add(imageUrl!);
  }

  // 2. Add unique assets from the ledger
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(url => {
      if (isValidAssetUrl(url)) {
        gallery.add(url);
      }
    });
  }

  // 3. Return user gallery if valid, otherwise return a single platform fallback
  return gallery.size > 0 ? Array.from(gallery) : [RENTALFLOW_FALLBACK];
}
