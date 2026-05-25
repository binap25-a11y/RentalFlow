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
 * USES URL.createObjectURL for extreme memory efficiency.
 * IF THE DEVICE HITS MEMORY LIMITS, it SILENTLY returns the original file.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<Blob | File> {
  // Skip non-images or very small files
  if (!file.type.startsWith('image/') || file.size < 1024 * 200) {
    return file;
  }

  try {
    return await new Promise((resolve) => {
      // Strict safety timeout (5s) to prevent blocking the UI
      const timeout = setTimeout(() => {
        console.warn("Optimization timed out, returning original.");
        resolve(file);
      }, 5000);

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Sequential Downscaling for RAM Stability
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
            URL.revokeObjectURL(objectUrl);
            clearTimeout(timeout);
            resolve(file);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);
              clearTimeout(timeout);
              if (blob && blob.size < file.size) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          URL.revokeObjectURL(objectUrl);
          clearTimeout(timeout);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
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
 * 🖼️ Strict User Asset Identifier
 */
export function isUserUploadedAsset(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '' || !url.startsWith('http')) return false;
  
  const isStorageAsset = url.includes('supabase.co') || url.includes('firebasestorage.app');
  const isGenericPlaceholder = 
    url.includes('picsum.photos') ||
    url.includes('placehold.co') ||
    url.includes('via.placeholder.com') ||
    url.includes('images.unsplash.com');
                    
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
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  if (isUserUploadedAsset(imageUrl)) return imageUrl!;
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstUserUrl = imageUrls.find(u => isUserUploadedAsset(u));
    if (firstUserUrl) return firstUserUrl;
  }
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
  const userUploads = result.filter(isUserUploadedAsset);
  if (userUploads.length > 0) return userUploads;
  return [RENTALFLOW_NEUTRAL_FALLBACK];
}
