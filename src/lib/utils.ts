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
export async function compressImage(file: File, maxWidth = 1200, quality = 0.85): Promise<Blob | File> {
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
 * 🖼️ User Asset Identifier (Hardened)
 * Whitelist-first logic targeting specifically project wgezhbkkhamaawxgcqjf.
 * Decisively REJECTS placeholders while allowing all Supabase binaries and local blobs.
 */
export function isRealUserUpload(url: any): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  
  const u = url.toLowerCase();
  
  // 1. PROJECT WHITELIST: Strictly authorize project-specific binaries
  const isAuthorized = (
    u.includes('wgezhbkkhamaawxgcqjf') || 
    u.includes('supabase.co') || 
    u.includes('firebasestorage') ||
    u.startsWith('blob:') ||
    u.startsWith('data:')
  );

  // 2. FORBIDDEN SIGNATURE BLACKLIST: Decisively reject known placeholders
  const forbidden = [
    'unsplash.com', 'picsum.photos', 'placehold.co', 'placeholder', 
    'pexels.com', 'images.unsplash.com',
    'photo-1486406146926-c627a92ad1ab', // skyscraper
    'photo-1560518883-ce09059eeffa'  // blue house logo
  ];

  const hasForbidden = forbidden.some(term => u.includes(term.toLowerCase()));

  return isAuthorized && !hasForbidden;
}

/**
 * 🖼️ Asset Validation Engine
 */
export function isValidAssetUrl(url: any): boolean {
  return !!(url && typeof url === 'string' && url.trim() !== '' && (url.startsWith('http') || url.startsWith('blob:')));
}

/**
 * 🖼️ Robust Asset Resolution Engine
 * DECISIVELY PRIORITIZES the designated primary cover from Firestore.
 */
export function getResolvedImageUrl(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string | null {
  // Priority 1: Specifically designated primary cover (imageUrl field)
  if (imageUrl && isValidAssetUrl(imageUrl) && isRealUserUpload(imageUrl)) {
    return imageUrl;
  }
  // Priority 2: First available verified cloud binary in the array
  if (imageUrls && Array.isArray(imageUrls)) {
    const realGallery = imageUrls.filter(isRealUserUpload);
    if (realGallery.length > 0) return realGallery[0];
  }
  return null;
}

/**
 * 🖼️ Synchronized Gallery Resolver
 */
export function getResolvedGallery(imageUrl: string | null | undefined, imageUrls: string[] | null | undefined): string[] {
  const assets = new Set<string>();
  
  // Primary cover ALWAYS goes first
  if (imageUrl && isValidAssetUrl(imageUrl) && isRealUserUpload(imageUrl)) {
    assets.add(imageUrl);
  }
  
  // Followed by all other verified binaries
  if (imageUrls && Array.isArray(imageUrls)) {
    imageUrls.forEach(u => {
      if (isValidAssetUrl(u) && isRealUserUpload(u)) {
        assets.add(u);
      }
    });
  }
  
  return Array.from(assets);
}
