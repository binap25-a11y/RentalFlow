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
 * Automatically retries async operations (like uploads) to handle flakey mobile networks.
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
 * Converts HEIC/PNG to high-quality JPG and downscales for 100% mobile stability.
 * Optimized for low-RAM devices: if optimization hits a memory limit or takes too long, it returns the original file.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<Blob | File> {
  if (!file.type.startsWith('image/') || file.size < 1024 * 300) {
    return file;
  }

  try {
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(file), 4000);
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
              // Clean up memory after processing
              URL.revokeObjectURL(objectUrl);
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
 * Strictly identifies assets that were intentionally uploaded (Supabase, Firebase, Blob).
 */
export function isRealUserUpload(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  return url.startsWith('blob:') || url.includes('supabase.co') || url.includes('firebasestorage.app');
}

/**
 * 🖼️ Asset Validation Engine
 */
export function isValidAssetUrl(url: any): boolean {
  return !!(url && typeof url === 'string' && url.trim() !== '' && (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:image/')));
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * Prioritizes user-uploaded content over placeholders.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // 1. Priority: User Uploads (Direct image or first image in gallery)
  if (isRealUserUpload(imageUrl)) return imageUrl!;
  
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstReal = imageUrls.find(u => isRealUserUpload(u));
    if (firstReal) return firstReal;
  }

  // 2. Secondary: Remote images (Unsplash seeds etc) that aren't the brand fallback
  if (isValidAssetUrl(imageUrl) && imageUrl !== RENTALFLOW_NEUTRAL_FALLBACK) return imageUrl!;
  
  // 3. Fallback: Neutral professional brand asset
  return RENTALFLOW_NEUTRAL_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
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
  const userUploads = result.filter(isRealUserUpload);
  
  // If user has uploaded any actual images, only show those to purge placeholders
  if (userUploads.length > 0) return userUploads;
  
  // Otherwise show existing valid URLs or the brand identity
  return result.length > 0 ? result : [RENTALFLOW_NEUTRAL_FALLBACK];
}
