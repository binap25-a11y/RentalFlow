import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Hardened Asset Resolution Engine
 * Ensures user-uploaded Supabase images are strictly prioritized over placeholders.
 * Logic: primary imageUrl (User content) -> first gallery item (User content) -> official fallback.
 */
export function getResolvedImageUrl(
  propertyId: string | undefined, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  // Official platform fallback
  const FALLBACK = "https://picsum.photos/seed/prop1/800/600";

  // 1. Prioritize primary imageUrl if it's a valid user-provided URL
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.startsWith('http') && !dbImageUrl.includes('picsum.photos')) {
    return dbImageUrl;
  }

  // 2. If no primary user image, pick the first valid image from the gallery array
  if (dbImageUrls && Array.isArray(dbImageUrls) && dbImageUrls.length > 0) {
    const firstUserImage = dbImageUrls.find(url => url && typeof url === 'string' && url.startsWith('http') && !url.includes('picsum.photos'));
    if (firstUserImage) return firstUserImage;
  }

  // 3. Last resort: Return the standard professional fallback (or the placeholder if it was intentionally set)
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.startsWith('http')) {
    return dbImageUrl;
  }

  return FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Deduplicates and orders the gallery with the primary cover image at index 0.
 * Ensures carousels show real user content over fallbacks.
 */
export function getResolvedGallery(
  propertyId: string | undefined,
  dbImageUrls: string[] | undefined,
  dbImageUrl: string | undefined
): string[] {
  const FALLBACK = "https://picsum.photos/seed/prop1/800/600";
  const userImages: string[] = [];

  // 1. Add primary image first if it's a valid user upload
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.startsWith('http') && !dbImageUrl.includes('picsum.photos')) {
    userImages.push(dbImageUrl);
  }

  // 2. Add other unique gallery URLs from the array
  if (dbImageUrls && Array.isArray(dbImageUrls)) {
    dbImageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.startsWith('http') && !url.includes('picsum.photos') && !userImages.includes(url)) {
        userImages.push(url);
      }
    });
  }

  // 3. If we have no real user images, but have placeholders, return them
  if (userImages.length === 0) {
    if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.startsWith('http')) {
      userImages.push(dbImageUrl);
    }
    if (dbImageUrls && Array.isArray(dbImageUrls)) {
      dbImageUrls.forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('http') && !userImages.includes(url)) {
          userImages.push(url);
        }
      });
    }
  }

  // 4. Final fallback if record is truly empty
  return userImages.length > 0 ? userImages : [FALLBACK];
}
