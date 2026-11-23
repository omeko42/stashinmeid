/**
 * Kompresi gambar maksimal di sisi browser sebelum diupload ke server/storage
 * agar foto struk 4-6 MB menyusut menjadi ~60-150 KB namun teks angka & merchant
 * tetap tajam terbaca (hemat kuota storage user).
 */

export interface CompressedImageResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Kompresi gambar struk/dokumen:
 * - Resize sisi terpanjang ke maksimal `maxDimension` (default 1280px).
 * - Konversi ke WebP (fallback JPEG jika browser tidak mendukung WebP encode).
 * - Turunkan kualitas bertahap (0.72 -> 0.58 -> 0.46) bila ukuran masih > targetBytes
 *   sehingga hasil sekecil mungkin tapi teks struk tetap terbaca jelas.
 */
export async function compressReceiptImage(
  file: File,
  opts?: { maxDimension?: number; targetBytes?: number }
): Promise<CompressedImageResult> {
  const originalBytes = file.size;
  const maxDimension = opts?.maxDimension ?? 1280;
  const targetBytes = opts?.targetBytes ?? 170 * 1024;

  // Jika bukan gambar yang bisa di-decode canvas (mis. HEIC mentah di browser non-Safari), kirim apa adanya
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return {
      file,
      originalBytes,
      compressedBytes: file.size,
      width: 0,
      height: 0,
    };
  }

  try {
    const img = await loadImageFromFile(file);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) {
      return {
        file,
        originalBytes,
        compressedBytes: file.size,
        width: 0,
        height: 0,
      };
    }

    const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        file,
        originalBytes,
        compressedBytes: file.size,
        width: srcW,
        height: srcH,
      };
    }

    // Latar putih bersih agar gambar PNG transparan tetap jelas terbaca
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dstW, dstH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dstW, dstH);

    // Uji dukungan WebP; fallback JPEG bila WebP tidak didukung
    let mime = 'image/webp';
    let ext = 'webp';
    let blob = await canvasToBlob(canvas, mime, 0.72);
    if (!blob || blob.type !== 'image/webp') {
      mime = 'image/jpeg';
      ext = 'jpg';
      blob = await canvasToBlob(canvas, mime, 0.72);
    }

    if (blob && blob.size > targetBytes) {
      const b2 = await canvasToBlob(canvas, mime, 0.58);
      if (b2 && b2.size < blob.size) blob = b2;
    }
    if (blob && blob.size > targetBytes * 1.35) {
      const b3 = await canvasToBlob(canvas, mime, 0.46);
      if (b3 && b3.size < blob.size) blob = b3;
    }

    if (!blob || blob.size >= originalBytes) {
      return {
        file,
        originalBytes,
        compressedBytes: file.size,
        width: dstW,
        height: dstH,
      };
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'struk';
    const compressedFile = new File([blob], `${baseName}.${ext}`, {
      type: mime,
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalBytes,
      compressedBytes: compressedFile.size,
      width: dstW,
      height: dstH,
    };
  } catch {
    return {
      file,
      originalBytes,
      compressedBytes: file.size,
      width: 0,
      height: 0,
    };
  }
}

export function formatFileBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
