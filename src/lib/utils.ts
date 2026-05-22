import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * Strictly prioritizes user-uploaded content over placeholders.
 * Tier 1: Explicit primary imageUrl (Designated User Cover)
 * Tier 2: First valid item in the gallery ledger (imageUrls[0])
 * Tier 3: Professional platform fallback
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  const FALLBACK = "https://picsum.photos/seed/rentalflow-default/800/600";
  
  const isValidUserUrl = (url: any) => 
    url && 
    typeof url === 'string' && 
    url.startsWith('http') && 
    !url.includes('picsum.photos/seed/rentalflow-default');

  // 1. If we have a valid, non-placeholder cover image, use it.
  if (isValidUserUrl(imageUrl)) {
    return imageUrl!;
  }
  
  // 2. If cover is empty/placeholder, check the gallery ledger for a user image.
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(isValidUserUrl);
    if (firstUserUrl) return firstUserUrl;
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
  const gallery = new Set<string>();

  const isValidUserUrl = (url: any) => 
    url && 
    typeof url === 'string' && 
    url.startsWith('http') && 
    !url.includes('picsum.photos/seed/rentalflow-default');

  // 1. Seed with the primary cover if it's a real user upload
  if (isValidUserUrl(imageUrl)) {
    gallery.add(imageUrl!);
  }

  // 2. Add unique assets from the ledger
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(url => {
      if (isValidUserUrl(url)) {
        gallery.add(url);
      }
    });
  }

  // 3. Return the user gallery if it exists, otherwise return a single placeholder
  return gallery.size > 0 ? Array.from(gallery) : [FALLBACK];
}
