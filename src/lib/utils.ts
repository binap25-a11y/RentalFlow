import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ High-Fidelity Professional Fallback
 * Used ONLY when a property has zero user-uploaded photography.
 */
export const RENTALFLOW_NEUTRAL_FALLBACK = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&auto=format&fit=crop";

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
 * Optimized for high-speed binary delivery (800px max) with premium clarity.
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
 * Strictly identifies assets that were intentionally uploaded.
 * Excludes stock placeholders from Unsplash, Picsum, etc.
 */
export function isRealUserUpload(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  const u = url.toLowerCase();
  
  // Explicitly identify and exclude stock placeholders
  if (
    u.includes('picsum.photos') || 
    u.includes('unsplash.com') || 
    u.includes('placehold.co') ||
    u.includes('placeholder')
  ) {
    return false;
  }

  // Identify real uploads (Supabase, Firebase, or in-session Blobs)
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
 * STORAGE-FIRST POLICY: Prioritizes user uploads and STRICTLY PURGES placeholders if real assets exist.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  const allPossible = [imageUrl, ...(imageUrls || [])].filter(isValidAssetUrl);
  const realUploads = allPossible.filter(isRealUserUpload).filter(u => !u.startsWith('blob:'));

  if (realUploads.length > 0) return realUploads[0];
  
  // Filter out any known stock domains even if they were passed in as defaults
  const nonStock = allPossible.filter(u => !u.includes('unsplash') && !u.includes('picsum') && !u.includes('placehold'));
  return nonStock.length > 0 ? nonStock[0] : RENTALFLOW_NEUTRAL_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * STORAGE-FIRST POLICY: If ANY user uploads exist, we strictly purge ALL original stock placeholders.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const assets = new Set<string>();
  if (imageUrl && isValidAssetUrl(imageUrl)) assets.add(imageUrl);
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(u => {
      if (isValidAssetUrl(u)) assets.add(u);
    });
  }
  
  const allAssets = Array.from(assets);
  const userUploads = allAssets.filter(isRealUserUpload).filter(u => !u.startsWith('blob:'));
  
  // Premium Enforcement: Once a user has uploaded any actual images, we strictly purge all stock placeholders
  if (userUploads.length > 0) return userUploads;
  
  // If no real uploads, return original assets only if they aren't stock placeholders
  const nonStockAssets = allAssets.filter(a => !a.includes('unsplash') && !a.includes('picsum') && !a.includes('placehold'));
  
  return nonStockAssets.length > 0 ? nonStockAssets : [RENTALFLOW_NEUTRAL_FALLBACK];
}
