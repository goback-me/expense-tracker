/**
 * Converts any selected image into a resized JPEG blob, ready to send to the
 * OCR API. Two problems this solves:
 *
 * 1. HEIC/HEIF compatibility. Chrome cannot decode HEIC/HEIF through an
 *    <img> tag on ANY platform — Windows, macOS, Linux, or Android — this is
 *    a long-standing, permanently unfixed Chromium limitation (tracked and
 *    marked "Won't Fix" upstream), not something specific to this app or a
 *    particular phone. Many Android photos, and virtually all photos shared
 *    from an iPhone, are HEIC. So: try the fast native <img> decode first
 *    (works for JPEG/PNG/WebP/AVIF in every browser), and only if that fails
 *    fall back to a WASM-based HEIC decoder (heic2any) that doesn't depend
 *    on the browser's own image codec at all.
 * 2. File size — phone camera photos are routinely 8-20MB. Downscaling to a
 *    sane max dimension before uploading makes scans noticeably faster and
 *    less likely to hit any request size limit.
 */
export async function normalizeToJpeg(
  blob: Blob,
  maxDimension = 1600,
  quality = 0.85
): Promise<Blob> {
  try {
    return await drawToJpeg(blob, maxDimension, quality);
  } catch {
    // Native decode failed — most likely HEIC/HEIF. Fall back to a WASM
    // decoder that works regardless of what the browser itself supports.
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob, toType: "image/jpeg", quality });
      const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
      return await drawToJpeg(convertedBlob, maxDimension, quality);
    } catch {
      throw new Error(
        "Couldn't read that image file — it may be corrupted or in an unsupported format."
      );
    }
  }
}

async function drawToJpeg(blob: Blob, maxDimension: number, quality: number): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = document.createElement("img");
    img.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Native decode failed"));
    });

    let { naturalWidth: width, naturalHeight: height } = img;

    if (!width || !height) {
      throw new Error("That image appears to be empty.");
    }

    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Your browser doesn't support image processing.");
    }

    ctx.drawImage(img, 0, 0, width, height);

    const result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (!result) {
      throw new Error("Couldn't process that image.");
    }

    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}