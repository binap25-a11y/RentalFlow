import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Constants for Visual Fallbacks
 * Using a professional architecture placeholder as the base identity.
 */
export const RENTALFLOW_FALLBACK = "https://picsum.photos/seed/rentalflow-default/800/600";

/**
 * 🖼️ User Asset Identifier
 * Strictly identifies images uploaded by users (typically Supabase or external professional links)
 * vs system-generated placeholders.
 */
export function isUserUploadedAsset(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '' || !url.startsWith('http')) return false;
  
  // Identify platform placeholder signatures
  const isPlaceholder = 
    url.includes('picsum.photos/seed/rentalflow-default') || 
    url.includes('placehold.co') ||
    url.includes('placehold.it');
                    
  return !isPlaceholder;
}

/**
 * 🖼️ Property Placeholder Identifier
 * Identifies property-specific placeholders (prop1, prop2) vs generic fallbacks.
 */
export function isPropertyPlaceholder(url: any): boolean {
  return typeof url === 'string' && url.includes('picsum.photos/seed/prop');
}

/**
 * 🖼️ Asset Validation Engine (General)
 * Returns true if the URL is a valid, renderable image string.
 */
export function isValidAssetUrl(url: any): boolean {
  return !!(url && typeof url === 'string' && url.trim() !== '' && url.startsWith('http'));
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * Strictly prioritizes user-uploaded content over placeholders for a specific property.
 * Tier 1: Explicit user-uploaded primary imageUrl
 * Tier 2: First user-uploaded item in the gallery ledger
 * Tier 3: Property-specific placeholder (if exists in DB)
 * Tier 4: Global platform fallback
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // 1. Prioritize user upload in the primary slot
  if (isUserUploadedAsset(imageUrl) && !isPropertyPlaceholder(imageUrl)) {
    return imageUrl!;
  }
  
  // 2. Fallback to the first user upload in the gallery
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(u => isUserUploadedAsset(u) && !isPropertyPlaceholder(u));
    if (firstUserUrl) return firstUserUrl;
  }
  
  // 3. Fallback to property-specific placeholder saved in DB
  if (isValidAssetUrl(imageUrl) && isPropertyPlaceholder(imageUrl)) {
    return imageUrl!;
  }

  // 4. Absolute system fallback
  return RENTALFLOW_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Reconstructs the full visual stack ensuring user assets are always prioritized at the start.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const userAssets = new Set<string>();
  const placeholderAssets = new Set<string>();

  const processUrl = (url: any) => {
    if (!isValidAssetUrl(url)) return;
    if (isUserUploadedAsset(url) && !isPropertyPlaceholder(url)) {
      userAssets.add(url);
    } else {
      placeholderAssets.add(url);
    }
  };

  processUrl(imageUrl);
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(processUrl);
  }

  // If we have user assets, return only those (replacing placeholders)
  if (userAssets.size > 0) {
    return Array.from(userAssets);
  }

  // Otherwise return placeholders or the global fallback
  return placeholderAssets.size > 0 ? Array.from(placeholderAssets) : [RENTALFLOW_FALLBACK];
}
