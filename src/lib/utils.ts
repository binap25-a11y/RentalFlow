import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import placeholderData from "@/app/lib/placeholder-images.json"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Professional Asset Resolution Engine
 * Ensures 100% consistency for images across all platform views.
 * Strictly prioritizes: Memory Bridge (Instant) -> Primary imageUrl (Cover) -> Gallery -> Placeholder.
 */
export function getResolvedImageUrl(
  propertyId: string | undefined, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  const officialFallback = placeholderData.placeholderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://picsum.photos/seed/prop1/800/600";

  if (!propertyId) return officialFallback;

  // 1. Check Memory Bridge (for zero-latency UI feedback after upload)
  if (typeof window !== 'undefined' && (window as any).__asset_bridge?.[propertyId]) {
    const bridgeUrls = (window as any).__asset_bridge[propertyId];
    if (bridgeUrls && bridgeUrls.length > 0 && typeof bridgeUrls[0] === 'string' && bridgeUrls[0].startsWith('http')) {
      return bridgeUrls[0];
    }
  }

  // 2. Prioritize Primary Cover Image
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 10 && dbImageUrl.startsWith('http')) {
    return dbImageUrl;
  }

  // 3. Fallback to first valid gallery URL
  if (dbImageUrls && Array.isArray(dbImageUrls) && dbImageUrls.length > 0) {
    const firstValid = dbImageUrls.find(u => typeof u === 'string' && u.length > 10 && u.startsWith('http'));
    if (firstValid) return firstValid;
  }

  return officialFallback;
}

/**
 * 🖼️ Full Gallery Resolver
 * Resolves the complete set of professional images for carousels and ledgers.
 * Ensures the primary cover image is always the first item.
 */
export function getResolvedGallery(
  propertyId: string | undefined,
  dbImageUrls: string[] | undefined,
  dbImageUrl: string | undefined
): string[] {
  const officialFallback = placeholderData.placeholderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://picsum.photos/seed/prop1/800/600";

  if (!propertyId) return [officialFallback];

  const gallery: string[] = [];

  // 1. Check Memory Bridge First
  if (typeof window !== 'undefined' && (window as any).__asset_bridge?.[propertyId]) {
    const bridgeUrls = (window as any).__asset_bridge[propertyId];
    if (bridgeUrls && Array.isArray(bridgeUrls)) {
      bridgeUrls.forEach(url => {
        if (url && typeof url === 'string' && url.startsWith('http')) {
          gallery.push(url);
        }
      });
      if (gallery.length > 0) return gallery;
    }
  }

  // 2. Prioritize Primary Cover Image as index 0
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.startsWith('http') && dbImageUrl.length > 10) {
    gallery.push(dbImageUrl);
  }

  // 3. Add other unique gallery URLs from DB
  if (dbImageUrls && Array.isArray(dbImageUrls)) {
    dbImageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.startsWith('http') && url.length > 10 && !gallery.includes(url)) {
        gallery.push(url);
      }
    });
  }

  return gallery.length > 0 ? gallery : [officialFallback];
}
