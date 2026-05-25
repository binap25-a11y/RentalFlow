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
 * 🖼️ Fail-Safe Client-Side Image Optimization
 * Optimized for mobile devices to prevent "Memory Exhaustion" or "Engine Failed" errors.
 * This version is designed to be 100% resilient: if anything fails, it returns the original file.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<Blob | File> {
  // 1. Instant skip for non-images or small files
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 300 * 1024) return file; 

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              console.warn('Sync Engine: Canvas unavailable. Using original binary.');
              return resolve(file);
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
              if (blob) {
                console.log(`Sync Ready: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(blob);
              } else {
                resolve(file);
              }
            }, 'image/jpeg', quality);
          } catch (err) {
            // 🛠️ CRITICAL FALLBACK: Returns original file if mobile RAM crashes
            console.warn('Sync Engine: Memory limit reached. Bypassing compression.');
            resolve(file);
          }
        };
        
        img.onerror = () => resolve(file);
      };

      reader.onerror = () => resolve(file);
    } catch (e) {
      resolve(file);
    }
  });
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
