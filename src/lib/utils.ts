import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🖼️ High-Fidelity Professional Fallback
 * Used ONLY in the UI when a property has zero user-uploaded photography.
 * This architectural facade is NEVER stored in the database.
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
 * Strictly identifies assets that were intentionally uploaded by the user to the cloud.
 * Excludes all stock domains and brand identity icons.
 */
export function isRealUserUpload(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  const u = url.toLowerCase();
  
  // List of forbidden partial matches (known placeholders)
  const forbidden = [
    'picsum.photos',
    'placehold.co',
    'placeholder.com'
  ];

  // We explicitly check for images.unsplash.com BUT allow it ONLY if it's NOT our fallback/logo
  // This is a safety measure in case a user actually pastes an unsplash link, 
  // though we prefer Supabase binaries.
  if (forbidden.some(f => u.includes(f))) return false;
  
  // Explicitly exclude brand identity assets and generic building fallbacks
  if (url === RENTALFLOW_LOGO_URL || url === RENTALFLOW_NEUTRAL_FALLBACK) return false;

  return true;
}

/**
 * 🖼️ Asset Validation Engine
 */
export function isValidAssetUrl(url: any): boolean {
  return !!(url && typeof url === 'string' && url.trim() !== '' && (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:image/')));
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * USER-DATA ONLY POLICY: Returns user photography if any exists. Returns fallback only as a UI last resort.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string {
  // 1. If explicit Cover URL is a real user upload, it IS the identity.
  if (imageUrl && isValidAssetUrl(imageUrl) && isRealUserUpload(imageUrl)) {
    return imageUrl;
  }

  // 2. Otherwise, look for the first real upload in the gallery array.
  if (imageUrls && Array.isArray(imageUrls)) {
    const realGallery = imageUrls.filter(isRealUserUpload);
    if (realGallery.length > 0) return realGallery[0];
  }

  // 3. UI Fallback (Never stored in DB)
  return RENTALFLOW_NEUTRAL_FALLBACK;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 * USER-DATA ONLY POLICY: Returns only real user assets. Returns fallback array if empty.
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const assets = new Set<string>();
  
  // Add cover if it's a real user upload
  if (imageUrl && isValidAssetUrl(imageUrl) && isRealUserUpload(imageUrl)) {
    assets.add(imageUrl);
  }
  
  // Add gallery assets that are real user uploads
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(u => {
      if (isValidAssetUrl(u) && isRealUserUpload(u)) {
        assets.add(u);
      }
    });
  }
  
  // High-fidelity resolution for detail hub
  const userUploads = Array.from(assets).filter(u => !u.startsWith('blob:'));
  
  if (userUploads.length > 0) {
    return userUploads;
  }
  
  // UI Fallback (Never stored in DB)
  return [RENTALFLOW_NEUTRAL_FALLBACK];
}
