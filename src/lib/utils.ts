import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import placeholderData from "@/app/lib/placeholder-images.json"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Enhanced Asset Resolution Engine
 * Ensures user-uploaded Supabase images are prioritized over placeholders.
 * Strictly prioritizes: dbImageUrl (if not placeholder) -> First gallery item -> Standard Fallback.
 */
export function getResolvedImageUrl(
  propertyId: string | undefined, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  // Official platform fallback from the centralized registry
  const FALLBACK = "https://picsum.photos/seed/prop1/800/600";

  // 1. Prioritize dbImageUrl if it's a valid user upload (not a picsum placeholder)
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 10 && !dbImageUrl.includes('picsum.photos')) {
    return dbImageUrl;
  }

  // 2. If no primary, pick the first valid user upload from the gallery array
  if (dbImageUrls && Array.isArray(dbImageUrls) && dbImageUrls.length > 0) {
    const firstUserImage = dbImageUrls.find(url => 
      url && typeof url === 'string' && url.length > 10 && !url.includes('picsum.photos')
    );
    if (firstUserImage) return firstUserImage;
  }

  // 3. Last resort: Return the standard professional fallback
  return FALLBACK;
}

/**
 * 🖼️ Enhanced Gallery Resolver
 * Deduplicates and orders the gallery with the primary image first.
 * Ensures carousels and ledgers show real user content over fallbacks.
 */
export function getResolvedGallery(
  propertyId: string | undefined,
  dbImageUrls: string[] | undefined,
  dbImageUrl: string | undefined
): string[] {
  const FALLBACK = "https://picsum.photos/seed/prop1/800/600";
  const userImages: string[] = [];

  // 1. Add primary image first if it's a user upload
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 10 && !dbImageUrl.includes('picsum.photos')) {
    userImages.push(dbImageUrl);
  }

  // 2. Add other unique gallery URLs from the array
  if (dbImageUrls && Array.isArray(dbImageUrls)) {
    dbImageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.length > 10 && !url.includes('picsum.photos') && !userImages.includes(url)) {
        userImages.push(url);
      }
    });
  }

  // 3. If we have no real images, return the fallback as the single item
  return userImages.length > 0 ? userImages : [FALLBACK];
}
