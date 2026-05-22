import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ High-Fidelity Professional Fallback
 * Used ONLY when a property has zero user-uploaded photography.
 * This is a neutral architectural image from Unsplash.
 */
export const RENTALFLOW_NEUTRAL_FALLBACK = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&auto=format&fit=crop";

/**
 * 🖼️ Strict User Asset Identifier
 * Strictly identifies images uploaded by users (Supabase or Firebase Storage).
 * Handles both public and signed URLs for private buckets.
 */
export function isUserUploadedAsset(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '' || !url.startsWith('http')) return false;
  
  const isStorageAsset = url.includes('supabase.co') || url.includes('firebasestorage.app');
  
  // Explicitly identify and EXCLUDE generic placeholders
  const isGenericPlaceholder = 
    url.includes('picsum.photos') ||
    url.includes('placehold.co') ||
    url.includes('via.placeholder.com') ||
    url.includes('images.unsplash.com'); // We treat Unsplash as fallback, not user content.
                    
  return isStorageAsset && !isGenericPlaceholder;
}

/**
 * 🖼️ Asset Validation Engine
 */
export function isValidAssetUrl(url: any): boolean {
  return !!(url && typeof url === 'string' && url.trim() !== '' && url.startsWith('http'));
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * Strictly prioritizes User Uploads over placeholders for a specific property context.
 * This ensures photography is UNIQUE to each property.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // 1. If explicit imageUrl is a verified user asset, use it immediately.
  if (isUserUploadedAsset(imageUrl)) return imageUrl!;
  
  // 2. Otherwise, look for the first verified user asset in the gallery array.
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(u => isUserUploadedAsset(u));
    if (firstUserUrl) return firstUserUrl;
  }
  
  // 3. Last resort: high-fidelity professional fallback.
  return RENTALFLOW_NEUTRAL_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Filters out placeholders if real photos exist for the specific property.
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
  
  // Filter for verified user uploads
  const userUploads = result.filter(isUserUploadedAsset);
  if (userUploads.length > 0) return userUploads;

  // Fallback if no real photos provided
  return [RENTALFLOW_NEUTRAL_FALLBACK];
}
