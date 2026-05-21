import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PlaceHolderImages } from "./placeholder-images"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Hardened Tiered Asset Resolution Engine
 * Ensures 100% consistency for images across all platform views.
 * Corrected to prioritize official high-fidelity fallbacks correctly.
 */
export function getResolvedImageUrl(
  propertyId: string, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  // Priority 0: Official High-Fidelity Fallback (Modern Apartment)
  const officialPlaceholder = PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || `https://picsum.photos/seed/prop-fallback/800/600`;

  // Server-side: Prioritize DB URL or fallback
  if (typeof window === 'undefined') {
    if (dbImageUrls && dbImageUrls.length > 0 && typeof dbImageUrls[0] === 'string' && dbImageUrls[0].length > 5) return dbImageUrls[0];
    return (dbImageUrl && dbImageUrl.length > 5) ? dbImageUrl : officialPlaceholder;
  }

  // Tier 1: Local Session Bridge (Zero-latency redirection feedback)
  const bridge = (window as any).__asset_bridge;
  const bridgeUrls = bridge?.[propertyId];
  if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0 && bridgeUrls[0].length > 5) {
    return bridgeUrls[0];
  }

  // Tier 2: Persistent Database URLs (Verified Supabase storage)
  if (dbImageUrls && dbImageUrls.length > 0 && typeof dbImageUrls[0] === 'string' && dbImageUrls[0].length > 5) {
    return dbImageUrls[0];
  }
  if (dbImageUrl && dbImageUrl.length > 5) {
    return dbImageUrl;
  }

  // Tier 3: High-Fidelity Professional Fallback
  return officialPlaceholder;
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
  const officialPlaceholder = PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || `https://picsum.photos/seed/prop-fallback/800/600`;

  // Server-side resolution
  if (typeof window === 'undefined') {
    const cleanDbUrls = (dbImageUrls || []).filter(u => typeof u === 'string' && u.length > 5);
    if (cleanDbUrls.length > 0) return cleanDbUrls;
    if (dbImageUrl && dbImageUrl.length > 5) return [dbImageUrl];
    return [officialPlaceholder];
  }

  // Tier 1: Memory Bridge (Instant updates)
  const bridge = (window as any).__asset_bridge;
  const bridgeUrls = bridge?.[propertyId];
  if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0) {
    return bridgeUrls.filter((u: string) => u.length > 5);
  }

  // Tier 2: Persistent Gallery
  const cleanDbUrls = (dbImageUrls || []).filter(u => typeof u === 'string' && u.length > 5);
  if (cleanDbUrls.length > 0) return cleanDbUrls;
  
  // Tier 3: Persistent Primary
  if (dbImageUrl && dbImageUrl.length > 5) return [dbImageUrl];

  // Tier 4: Professional Fallback
  return [officialPlaceholder];
}
