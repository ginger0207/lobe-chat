/**
 * Compress and resize an image file to meet custom requirements.
 * - Keeps aspect ratio.
 * - Short side <= maxShortSide, long side <= maxLongSide.
 * - File size <= maxSizeBytes.
 * - Output format and quality are configurable.
 *
 * Usage:
 *   const compressedFile = await compressImageFileWithLimit(file, { ...options });
 */
export async function compressImageFileWithLimit(
  file: File,
  {
    maxLongSide = 1568,
    maxShortSide = 768,
    maxSizeBytes = 19 * 1024 * 1024, // 19MB
    mimeType = 'image/webp',
    initialQuality = 0.92,
    minQuality = 0.5,
    qualityStep = 0.07,
  }: {
    initialQuality?: number;
    maxLongSide?: number;
    maxShortSide?: number;
    maxSizeBytes?: number;
    mimeType?: string;
    minQuality?: number;
    qualityStep?: number;
  } = {}
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  // Convert File to DataURL
  const fileToDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result as string));
      reader.addEventListener('error', () => reject(new Error('FileReader error')));
      reader.readAsDataURL(file);
    });

  // Convert DataURL to HTMLImageElement
  const dataURLToImage = (dataURL: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', () => reject(new Error('Image load error')));
      img.src = dataURL;
    });

  let quality = initialQuality;
  let dataURL = await fileToDataURL(file);
  let img = await dataURLToImage(dataURL);

  // Calculate new dimensions while keeping aspect ratio
  let width = img.width;
  let height = img.height;
  const isPortrait = height >= width;
  let shortSide = isPortrait ? width : height;
  let longSide = isPortrait ? height : width;

  let scale = 1;
  if (shortSide > maxShortSide || longSide > maxLongSide) {
    scale = Math.min(maxShortSide / shortSide, maxLongSide / longSide);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Compress and adjust quality until file size is under limit
  let compressedDataURL = '';
  let blob: Blob;
  do {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0, width, height);
    compressedDataURL = canvas.toDataURL(mimeType, quality);
    const res = await fetch(compressedDataURL);
    blob = await res.blob();
    quality -= qualityStep;
  } while ((blob.size > maxSizeBytes) && quality > minQuality);

  // Convert DataURL back to File
  const arr = compressedDataURL.split(',');
  const outMime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], file.name.replace(/\.\w+$/, '.webp'), { type: outMime });
}
