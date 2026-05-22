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
    url.includes('placehold.it') ||
    url.includes('picsum.photos/seed/prop');
                    
  return !isPlaceholder;
}

/**
 * 🖼️ Property Placeholder Identifier
 */
export function isPropertyPlaceholder(url: any): boolean {
  return typeof url === 'string' && url.includes('picsum.photos/seed/prop');
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
 * Tier 3: Property placeholder
 * Tier 4: Global fallback
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // If the primary cover is already a user upload, stick with it
  if (isUserUploadedAsset(imageUrl)) return imageUrl!;
  
  // If not, look for any user upload in the broader gallery
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(u => isUserUploadedAsset(u));
    if (firstUserUrl) return firstUserUrl;
  }
  
  // If no user uploads exist, but we have a valid placeholder link, use that
  if (isValidAssetUrl(imageUrl)) return imageUrl!;

  // Absolute fallback
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
