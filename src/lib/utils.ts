import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PlaceHolderImages } from "./placeholder-images"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Tiered Asset Resolution Engine
 * Ensures 100% consistency for images across all platform views.
 */
export function getResolvedImageUrl(
  propertyId: string, 
  dbImageUrl: string | undefined, 
  dbImageUrls: string[] | undefined
): string {
  if (typeof window === 'undefined') return dbImageUrl || '';

  // Tier 1: Local Session Bridge (Zero-latency redirection feedback)
  const bridge = (window as any).__asset_bridge;
  const bridgeUrls = bridge?.[propertyId];
  if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0) {
    return bridgeUrls[0];
  }

  // Tier 2: Persistent Database URLs
  if (dbImageUrls && dbImageUrls.length > 0 && typeof dbImageUrls[0] === 'string' && dbImageUrls[0].length > 5) {
    return dbImageUrls[0];
  }
  if (dbImageUrl && dbImageUrl.length > 5) {
    return dbImageUrl;
  }

  // Tier 3: Professional Fallback
  return PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || `https://picsum.photos/seed/${propertyId}/800/600`;
}

/**
 * 🖼️ Full Gallery Resolver
 */
export function getResolvedGallery(
  propertyId: string,
  dbImageUrls: string[] | undefined,
  dbImageUrl: string | undefined
): string[] {
  if (typeof window === 'undefined') return [];

  const bridge = (window as any).__asset_bridge;
  const bridgeUrls = bridge?.[propertyId];
  if (bridgeUrls && Array.isArray(bridgeUrls) && bridgeUrls.length > 0) {
    return bridgeUrls;
  }

  const cleanDbUrls = (dbImageUrls || []).filter(u => typeof u === 'string' && u.length > 5);
  if (cleanDbUrls.length > 0) return cleanDbUrls;
  
  if (dbImageUrl && dbImageUrl.length > 5) return [dbImageUrl];

  return [PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || `https://picsum.photos/seed/${propertyId}/800/600`];
}
