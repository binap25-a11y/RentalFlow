import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import placeholderData from "@/app/lib/placeholder-images.json"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Hardened Asset Resolution Engine
 * Ensures 100% consistency for images across all platform views.
 * Strictly prioritizes: Memory Bridge (Instant) -> Database URLs -> Official Placeholder.
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
    if (bridgeUrls.length > 0) return bridgeUrls[0];
  }

  // 2. Prioritize Gallery Array (The robust collection)
  if (dbImageUrls && Array.isArray(dbImageUrls) && dbImageUrls.length > 0) {
    const firstValid = dbImageUrls.find(u => typeof u === 'string' && u.length > 10 && u.startsWith('http'));
    if (firstValid) return firstValid;
  }

  // 3. Fallback to Primary Image field
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 10 && dbImageUrl.startsWith('http')) {
    return dbImageUrl;
  }

  return officialFallback;
}

/**
 * 🖼️ Full Gallery Resolver
 * Resolves the complete set of professional images for carousels and ledgers.
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
    if (bridgeUrls.length > 0) return bridgeUrls;
  }

  // 2. Add all valid gallery URLs from DB
  if (dbImageUrls && Array.isArray(dbImageUrls)) {
    dbImageUrls.forEach(url => {
      if (url && typeof url === 'string' && url.startsWith('http')) {
        gallery.push(url);
      }
    });
  }

  // 3. Ensure primary image is included if not already in gallery
  if (dbImageUrl && dbImageUrl.startsWith('http') && !gallery.includes(dbImageUrl)) {
    gallery.unshift(dbImageUrl);
  }

  return gallery.length > 0 ? gallery : [officialFallback];
}
