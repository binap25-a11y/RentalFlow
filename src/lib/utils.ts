import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ Constants for Visual Fallbacks
 * Used ONLY when no user photos exist.
 */
export const RENTALFLOW_FALLBACK = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1000&auto=format&fit=crop";

/**
 * 🖼️ User Asset Identifier
 * Strictly identifies images uploaded by users (Supabase or external links)
 * vs generic platform-generated placeholders.
 */
export function isUserUploadedAsset(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '' || !url.startsWith('http')) return false;
  
  // Explicitly identify and EXCLUDE generic placeholders
  const isPlaceholder = 
    url.includes('picsum.photos') ||
    url.includes('placehold.co');
                    
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
 * Strictly prioritizes User Uploads over placeholders.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // Priority 1: Primary cover is a verified user upload
  if (isUserUploadedAsset(imageUrl)) return imageUrl!;
  
  // Priority 2: Any verified user upload in the broader gallery ledger
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(u => isUserUploadedAsset(u));
    if (firstUserUrl) return firstUserUrl;
  }
  
  // Priority 3: Global fallback (Professional Unsplash Image)
  return RENTALFLOW_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Filters out placeholders if real photos exist.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const assets = new Set<string>();

  if (imageUrl && isValidAssetUrl(imageUrl)) assets.add(imageUrl);
  
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(u => {
      if (isValidAssetUrl(u)) assets.add(u);
    });
  }

  const result = Array.from(assets);
  
  // If landlord has provided ANY professional photos, filter out the generic placeholders
  const userUploads = result.filter(isUserUploadedAsset);
  if (userUploads.length > 0) return userUploads;

  // Fallback to the professional default if no photos exist
  return [RENTALFLOW_FALLBACK];
}
