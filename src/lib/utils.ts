import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import placeholderData from "@/app/lib/placeholder-images.json"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Bulletproof Asset Resolution Engine
 * Ensures 100% consistency for images across all platform views.
 * Strictly prioritizes: Primary dbImageUrl -> First item in dbImageUrls -> Official Fallback.
 */
export function getResolvedImageUrl(
  propertyId: string | undefined, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  const officialFallback = placeholderData.placeholderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://picsum.photos/seed/prop1/800/600";

  // 1. Prioritize Primary Cover Image from DB
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.startsWith('http') && !dbImageUrl.includes('picsum.photos')) {
    return dbImageUrl;
  }

  // 2. Fallback to first valid gallery URL from DB (excluding placeholders)
  if (dbImageUrls && Array.isArray(dbImageUrls) && dbImageUrls.length > 0) {
    const firstValid = dbImageUrls.find(u => u && typeof u === 'string' && u.startsWith('http') && !u.includes('picsum.photos'));
    if (firstValid) return firstValid;
  }

  // 3. Last resort fallback
  return officialFallback;
}

/**
 * 🖼️ Full Gallery Resolver
 * Resolves the complete set of professional images for carousels and ledgers.
 * Ensures the primary cover image is always the first item and deduplicated.
 */
export function getResolvedGallery(
  propertyId: string | undefined,
  dbImageUrls: string[] | undefined,
  dbImageUrl: string | undefined
): string[] {
  const officialFallback = placeholderData.placeholderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://picsum.photos/seed/prop1/800/600";

  const gallery: string[] = [];

  // 1. Prioritize Primary Cover Image as index 0 (if it's a real user image)
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.startsWith('http') && !dbImageUrl.includes('picsum.photos')) {
    gallery.push(dbImageUrl);
  }

  // 2. Add other unique gallery URLs from DB (excluding placeholders)
  if (dbImageUrls && Array.isArray(dbImageUrls)) {
    dbImageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.startsWith('http') && !url.includes('picsum.photos') && !gallery.includes(url)) {
        gallery.push(url);
      }
    });
  }

  // If we have no user images, return the fallback as the only item
  if (gallery.length === 0) return [officialFallback];

  return gallery;
}
