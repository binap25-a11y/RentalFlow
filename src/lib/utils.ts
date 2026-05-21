import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PlaceHolderImages } from "./placeholder-images"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Hardened Tiered Asset Resolution Engine
 * Ensures 100% consistency for images across all platform views.
 * Strictly prioritizes Memory Bridge -> Database -> Professional Fallback.
 */
export function getResolvedImageUrl(
  propertyId: string | undefined, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  const officialFallback = PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800&auto=format&fit=crop";

  if (!propertyId) return officialFallback;

  // Tier 1: Local Session Bridge (Instant feedback for uploads)
  if (typeof window !== 'undefined') {
    const bridge = (window as any).__asset_bridge;
    const bridgeUrls = bridge?.[propertyId];
    if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0) {
      const firstValid = bridgeUrls.find((u: any) => typeof u === 'string' && u.length > 5);
      if (firstValid) return firstValid;
    }
  }

  // Tier 2: Persistent Database URLs
  if (dbImageUrls && Array.isArray(dbImageUrls)) {
    const validGalleryUrls = dbImageUrls.filter(u => typeof u === 'string' && u.length > 5);
    if (validGalleryUrls.length > 0) return validGalleryUrls[0];
  }
  
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 5) {
    return dbImageUrl;
  }

  return officialFallback;
}

/**
 * 🖼️ Full Gallery Resolver
 * Merges memory bridge states with persistent database records for consistent carousels.
 */
export function getResolvedGallery(
  propertyId: string | undefined,
  dbImageUrls: string[] | undefined,
  dbImageUrl: string | undefined
): string[] {
  const officialFallback = PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800&auto=format&fit=crop";

  if (!propertyId) return [officialFallback];

  // Tier 1: Memory Bridge
  if (typeof window !== 'undefined') {
    const bridge = (window as any).__asset_bridge;
    const bridgeUrls = bridge?.[propertyId];
    if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0) {
      const cleanBridge = bridgeUrls.filter((u: any) => typeof u === 'string' && u.length > 5);
      if (cleanBridge.length > 0) return cleanBridge;
    }
  }

  // Tier 2: Persistent Gallery
  const cleanDbUrls = (dbImageUrls || []).filter(u => typeof u === 'string' && u.length > 5);
  if (cleanDbUrls.length > 0) return cleanDbUrls;
  
  // Tier 3: Primary Image
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 5) return [dbImageUrl];

  return [officialFallback];
}
