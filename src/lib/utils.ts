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
 * Built to be Server-Side Safe to avoid random placeholder flickering.
 */
export function getResolvedImageUrl(
  propertyId: string, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  // Official High-Fidelity Fallback (Modern Apartment)
  const officialFallback = PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800&auto=format&fit=crop";

  // Tier 1: Local Session Bridge (Zero-latency redirection feedback)
  if (typeof window !== 'undefined') {
    const bridge = (window as any).__asset_bridge;
    const bridgeUrls = bridge?.[propertyId];
    if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0 && typeof bridgeUrls[0] === 'string' && bridgeUrls[0].length > 5) {
      return bridgeUrls[0];
    }
  }

  // Tier 2: Persistent Database URLs (Verified storage)
  if (dbImageUrls && Array.isArray(dbImageUrls)) {
    const validGalleryUrls = dbImageUrls.filter(u => u && typeof u === 'string' && u.length > 5);
    if (validGalleryUrls.length > 0) return validGalleryUrls[0];
  }
  
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 5) {
    return dbImageUrl;
  }

  // Tier 3: High-Fidelity Professional Fallback (Consistent across SSR/CSR)
  return officialFallback;
}

/**
 * 🖼️ Full Gallery Resolver
 * Merges memory bridge states with persistent database records for consistent carousels.
 */
export function getResolvedGallery(
  propertyId: string,
  dbImageUrls: string[] | undefined,
  dbImageUrl: string | undefined
): string[] {
  const officialFallback = PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800&auto=format&fit=crop";

  // Tier 1: Memory Bridge (Instant updates during navigation)
  if (typeof window !== 'undefined') {
    const bridge = (window as any).__asset_bridge;
    const bridgeUrls = bridge?.[propertyId];
    if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0) {
      return bridgeUrls.filter((u: string) => typeof u === 'string' && u.length > 5);
    }
  }

  // Tier 2: Persistent Gallery from DB
  const cleanDbUrls = (dbImageUrls || []).filter(u => typeof u === 'string' && u.length > 5);
  if (cleanDbUrls.length > 0) return cleanDbUrls;
  
  // Tier 3: Primary Image from DB
  if (dbImageUrl && typeof dbImageUrl === 'string' && dbImageUrl.length > 5) return [dbImageUrl];

  // Tier 4: Professional Fallback
  return [officialFallback];
}
