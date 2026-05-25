import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ High-Fidelity Professional Fallback
 * Used ONLY when a property has zero user-uploaded photography.
 * This is a neutral architectural shot, NOT the brand logo.
 */
export const RENTALFLOW_NEUTRAL_FALLBACK = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop";

/**
 * 🏢 Brand Identity Asset
 * Used EXCLUSIVELY for the company logo and authentication branding (House & Keys).
 */
export const RENTALFLOW_LOGO_URL = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=512&h=512&auto=format&fit=crop";

/**
 * 🔄 Resilient Retry Wrapper
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * 🖼️ Resilient Mobile Optimization Engine
 */
export async function compressImage(file: File, maxWidth = 800, quality = 0.75): Promise<Blob | File> {
  if (!file.type.startsWith('image/') || file.size < 1024 * 100) {
    return file;
  }

  try {
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(file), 2500);
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxWidth) {
              width *= maxWidth / height;
              height = maxWidth;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            clearTimeout(timeout);
            resolve(file);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout);
              resolve(blob && blob.size < file.size ? blob : file);
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          clearTimeout(timeout);
          resolve(file);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(file);
      };

      img.src = objectUrl;
    });
  } catch (error) {
    return file;
  }
}

/**
 * 🖼️ User Asset Identifier
 * Strictly identifies assets that were intentionally uploaded by the user.
 * Excludes known stock domains and the specific Brand Logo to prevent identity collision.
 */
export function isRealUserUpload(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  const u = url.toLowerCase();
  
  // Blacklist: Known stock and brand identity sources
  if (
    u.includes('images.unsplash.com') || 
    u.includes('picsum.photos') || 
    u.includes('placehold.co') ||
    u.includes('placeholder.com') ||
    url === RENTALFLOW_LOGO_URL
  ) {
    return false;
  }

  // Whitelist: Supabase, Firebase, Blobs, DataURIs
  return u.startsWith('blob:') || u.includes('supabase.co') || u.includes('firebasestorage') || u.startsWith('data:image/');
}

/**
 * 🖼️ Asset Validation Engine
 */
export function isValidAssetUrl(url: any): boolean {
  return !!(url && typeof url === 'string' && url.trim() !== '' && (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:image/')));
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * STORAGE-FIRST POLICY: Prioritizes user uploads and STRICTLY PURGES placeholders/logos if real assets exist.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // 1. If explicit Cover URL is a real user upload, it IS the identity.
  if (imageUrl && isValidAssetUrl(imageUrl) && isRealUserUpload(imageUrl)) {
    return imageUrl;
  }

  // 2. Otherwise, look for the first real upload in the gallery.
  if (imageUrls && Array.isArray(imageUrls)) {
    const realGallery = imageUrls.filter(isRealUserUpload).filter(u => !u.startsWith('blob:'));
    if (realGallery.length > 0) return realGallery[0];
  }

  // 3. Fallback to Neutral Architecture facade
  return RENTALFLOW_NEUTRAL_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * STORAGE-FIRST POLICY: If ANY user uploads exist, we strictly purge ALL original stock placeholders.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const assets = new Set<string>();
  
  // Prioritize cover first if valid
  if (imageUrl && isValidAssetUrl(imageUrl)) assets.add(imageUrl);
  
  // Add gallery assets
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(u => {
      if (isValidAssetUrl(u)) assets.add(u);
    });
  }
  
  const allAssets = Array.from(assets);
  const userUploads = allAssets.filter(isRealUserUpload).filter(u => !u.startsWith('blob:'));
  
  // Once a user has uploaded any actual images, we strictly purge all stock placeholders and brand logos
  if (userUploads.length > 0) return userUploads;
  
  // If no real uploads, return neutral fallback only
  return [RENTALFLOW_NEUTRAL_FALLBACK];
}
