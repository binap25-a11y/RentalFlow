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
 * Strictly identifies images uploaded by users (Supabase or external links)
 * vs system-generated placeholders.
 */
export function isUserUploadedAsset(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '' || !url.startsWith('http')) return false;
  
  // Identify platform placeholder signatures
  const isPlaceholder = 
    url.includes('picsum.photos/seed/rentalflow-default') || 
    url.includes('placehold.co') ||
    url.includes('placehold.it') ||
    url.includes('picsum.photos/seed/prop');
                    
  return !isPlaceholder;
}

/**
 * 🖼️ Asset Validation Engine
 */
export function isValidAssetUrl(url: any): boolean {
  return !!(url && typeof url === 'string' && url.trim() !== '' && url.startsWith('http'));
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * Tier 1: Explicit primary imageUrl (if user uploaded)
 * Tier 2: First user uploaded item in gallery ledger
 * Tier 3: Valid placeholder link
 * Tier 4: Global fallback
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // Priority 1: Primary cover is a user upload
  if (isUserUploadedAsset(imageUrl)) return imageUrl!;
  
  // Priority 2: Any user upload in the broader gallery
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(u => isUserUploadedAsset(u));
    if (firstUserUrl) return firstUserUrl;
  }
  
  // Priority 3: Fallback to existing valid URL (placeholder)
  if (isValidAssetUrl(imageUrl)) return imageUrl!;

  // Priority 4: Absolute fallback
  return RENTALFLOW_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Ensures that if any user images exist, placeholders are hidden to maintain a professional look.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const assets = new Set<string>();

  const addIfValid = (url: any) => {
    if (isValidAssetUrl(url)) assets.add(url);
  };

  // Prioritize primary cover
  addIfValid(imageUrl);
  
  // Add gallery items
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(addIfValid);
  }

  const result = Array.from(assets);
  
  // Logic: If the landlord has uploaded ANY professional photos, hide the generic forest/waves placeholders.
  const userUploads = result.filter(isUserUploadedAsset);
  if (userUploads.length > 0) return userUploads;

  // Fallback to placeholders if no professional photos exist
  return result.length > 0 ? result : [RENTALFLOW_FALLBACK];
}
