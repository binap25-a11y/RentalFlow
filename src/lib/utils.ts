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
 * Converts HEIC/PNG/TIFF to High-Quality JPEG (1000px max).
 * Hardened to ensure blob URLs are not revoked prematurely.
 */
export async function compressImage(file: File, maxWidth = 1000, quality = 0.6): Promise<Blob | File> {
  if (!file.type.startsWith('image/') || file.size < 1024 * 300) {
    return file;
  }

  try {
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(file), 3000);
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
 * Strictly identifies assets that were intentionally uploaded or are in-flight blobs.
 */
export function isRealUserUpload(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  const u = url.toLowerCase();
  
  // Explicitly identify and exclude stock placeholders
  if (u.includes('picsum.photos') || u.includes('unsplash.com') || u.includes('placehold.co')) {
    return false;
  }

  // Identify real uploads (Supabase, Firebase, or in-session Blobs)
  return u.startsWith('blob:') || 
         u.includes('supabase') || 
         u.includes('firebasestorage') ||
         u.includes('googleapi') ||
         u.includes('googleusercontent');
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
  // If the primary image is a real user upload, use it
  if (isRealUserUpload(imageUrl)) return imageUrl!;
  
  // Check the gallery for any real user uploads
  if (imageUrls && Array.isArray(imageUrls)) {
    const firstReal = imageUrls.find(u => isRealUserUpload(u));
    if (firstReal) return firstReal;
  }

  // Fallback to existing valid URL if it's not the brand fallback
  if (isValidAssetUrl(imageUrl) && imageUrl !== RENTALFLOW_NEUTRAL_FALLBACK) return imageUrl!;
  
  return RENTALFLOW_NEUTRAL_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * STORAGE-FIRST POLICY: If ANY user uploads exist, we strictly purge ALL original placeholders.
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
  const userUploads = allAssets.filter(isRealUserUpload);
  
  // Premium Enforcement: If user has uploaded any actual images, only show those to keep it professional
  if (userUploads.length > 0) return userUploads;
  
  return allAssets.length > 0 ? allAssets : [RENTALFLOW_NEUTRAL_FALLBACK];
}
