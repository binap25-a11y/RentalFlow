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
 * 🖼️ User Asset Identifier
 * Strictly identifies images uploaded by users (Supabase or external verified links)
 * vs generic platform-generated placeholders.
 */
export function isUserUploadedAsset(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '' || !url.startsWith('http')) return false;
  
  // Strictly identify and EXCLUDE generic placeholders to ensure a professional look
  const isGenericPlaceholder = 
    url.includes('picsum.photos') ||
    url.includes('placehold.co') ||
    url.includes('via.placeholder.com') ||
    url.includes('images.unsplash.com/photo-') && url.includes('placeholder'); // Catch explicit placeholders from unsplash if any
                    
  return !isGenericPlaceholder;
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
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // Priority 1: Primary cover is a verified user upload
  if (isUserUploadedAsset(imageUrl)) return imageUrl!;
  
  // Priority 2: Search specific property's gallery ledger for any verified upload
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(u => isUserUploadedAsset(u));
    if (firstUserUrl) return firstUserUrl;
  }
  
  // Priority 3: Neutral architectural fallback (Professionally sourced)
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
  
  // Filter out the generic placeholders if the landlord has provided ANY professional photos
  const userUploads = result.filter(isUserUploadedAsset);
  if (userUploads.length > 0) return userUploads;

  // Fallback to the architectural default if no photos exist
  return [RENTALFLOW_NEUTRAL_FALLBACK];
}
