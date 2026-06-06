import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🏢 Brand Identity Asset
 */
export const RENTALFLOW_LOGO_URL = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=512&h=512&auto=format&fit=crop";

/**
 * 🖼️ High-Fidelity Fallback Registry
 * High-resolution architectural asset for a professional portfolio aesthetic.
 */
export const PROPERTY_PLACEHOLDER = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&h=800&auto=format&fit=crop";

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
 * 🖼️ Asset Validation Engine
 * Relaxed to ensure all cloud storage paths (Signed/Public), blobs, and data URIs are authorized.
 * Hardened to reject string-serialized null/undefined values that cause broken icons or runtime crashes.
 */
export function isValidAssetUrl(url: any): boolean {
  // TYPE GUARD: Prevent trimEnd/toLowerCase on non-strings
  if (!url || typeof url !== 'string') return false;
  
  const trimmed = url.trim();
  if (trimmed.length < 5) return false; 
  
  const lower = trimmed.toLowerCase();
  
  // Explicitly reject known corrupt metadata strings
  if (
    lower === 'undefined' || 
    lower === 'null' || 
    lower === '[object object]' ||
    lower.includes('placeholder-empty')
  ) return false;
  
  return (
    lower.startsWith('http') || 
    lower.startsWith('blob:') || 
    lower.startsWith('data:')
  );
}

/**
 * 🖼️ User Asset Identifier
 * Verifies if the asset is a legitimate user upload or trusted external source.
 */
export function isRealUserUpload(url: any): boolean {
  if (!isValidAssetUrl(url)) return false;
  const u = String(url || "").toLowerCase();
  return (
    u.includes('supabase.co') || 
    u.includes('firebasestorage') ||
    u.includes('googleapi') ||
    u.includes('picsum.photos') ||
    u.includes('unsplash.com') ||
    u.startsWith('blob:') ||
    u.startsWith('data:')
  );
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * Prioritizes designated primary images with a resilient gallery fallback.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  if (isValidAssetUrl(imageUrl)) return imageUrl as string;
  
  if (imageUrls && Array.isArray(imageUrls)) {
    const validUrl = imageUrls.find(u => isValidAssetUrl(u));
    if (validUrl) return validUrl;
  }
  
  return PROPERTY_PLACEHOLDER;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * Deduplicates and validates all visual assets for a property.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const assets = new Set<string>();
  
  if (isValidAssetUrl(imageUrl)) {
    assets.add(imageUrl!);
  }
  
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(u => {
      if (isValidAssetUrl(u)) {
        assets.add(u);
      }
    });
  }
  
  if (assets.size === 0) {
    assets.add(PROPERTY_PLACEHOLDER);
  }
  
  return Array.from(assets);
}

/**
 * 🖼️ Resilient Mobile Optimization Engine
 * Compresses images client-side before cloud transmission to save bandwidth.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<Blob | File> {
  if (!file || !file.type.startsWith('image/') || file.size < 1024 * 100) {
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
