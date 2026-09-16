import imageCompression from 'browser-image-compression';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'cvatrn7a';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'vialidad_unsigned';

/**
 * Compresses an image file in the browser (max 1200px width, quality ~0.75)
 * and uploads it directly to Cloudinary using an unsigned upload preset.
 *
 * @param file The image File selected or captured by the user.
 * @returns Promise<string> Resolves with the secure_url from Cloudinary.
 */
export async function compressAndUploadImage(file: File): Promise<string> {
  // 1. Image compression options
  const compressionOptions = {
    maxWidthOrHeight: 1200,
    initialQuality: 0.75,
    useWebWorker: true,
    maxSizeMB: 1,
  };

  // 2. Compress image in browser
  const compressedFile = await imageCompression(file, compressionOptions);

  // 3. Prepare FormData for Cloudinary
  const formData = new FormData();
  formData.append('file', compressedFile);
  formData.append('upload_preset', UPLOAD_PRESET);

  // 4. Send direct unsigned POST request to Cloudinary API
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error?.message || `Error ${response.status} al subir imagen a Cloudinary`;
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error('Respuesta de Cloudinary inválida: no se recibió secure_url');
  }

  return data.secure_url;
}

/**
 * Inserts Cloudinary transformation string right after '/upload/' in the secure_url.
 * If the URL is not hosted on Cloudinary, returns the original URL safely.
 */
export function getCloudinaryTransformedUrl(url: string, transformation: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  // Avoid duplicating transformations if already transformed
  if (url.includes(`/upload/${transformation}/`)) {
    return url;
  }
  return url.replace('/upload/', `/upload/${transformation}/`);
}

/**
 * Generates optimized 150x150 fill thumbnail for map pins, admin panel and small icons,
 * with face blurring for privacy.
 */
export function getMapThumbnailUrl(url: string): string {
  return getCloudinaryTransformedUrl(url, 'w_150,h_150,c_fill,e_blur_faces:2000,f_auto,q_auto');
}

/**
 * Generates optimized 800px width banner for the detail modal,
 * with face blurring for privacy.
 */
export function getDetailModalImageUrl(url: string): string {
  return getCloudinaryTransformedUrl(url, 'w_800,e_blur_faces:2000,f_auto,q_auto');
}

