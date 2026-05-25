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
 * 🖼️ Client-Side Image Compression (Fail-Safe)
 * Optimized for mobile devices to prevent "Memory Exhaustion" or "Connection Interrupted" errors.
 * If compression fails (common with massive 4K/12MP photos on mobile RAM), it falls back to the original file.
 */
export async function compressImage(file: File, maxWidth = 1200, quality = 0.75): Promise<Blob | File> {
  // 1. Skip if not an image or very small (already optimized)
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 200 * 1024) return file; // Skip if < 200KB

  return new Promise((resolve) => {
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

          // Only resize if significantly larger than target
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.warn('Compression: Canvas context unavailable. Using original file.');
            return resolve(file);
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              console.log(`Compression Complete: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
              resolve(blob);
            } else {
              console.warn('Compression: Blob conversion failed. Using original file.');
              resolve(file);
            }
          }, 'image/jpeg', quality);
        } catch (err) {
          console.error('Compression Engine Error (Memory/RAM):', err);
          // 🛠️ CRITICAL FALLBACK: Return original file if compression crashes on mobile
          resolve(file);
        }
      };
      
      img.onerror = (err) => {
        console.error('Compression: Image loading error. Using original file.', err);
        resolve(file);
      };
    };

    reader.onerror = (error) => {
      console.error('Compression: FileReader error. Using original file.', error);
      resolve(file);
    };
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
