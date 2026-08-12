/**
 * Converts any browser-loadable image (including HEIC photos from an iPhone
 * gallery) into a resized JPEG blob. Two problems this solves:
 *
 * 1. HEIC/HEIF compatibility — decoding happens via a native <img> tag,
 *    which uses the OS/browser's own image codecs, then we redraw to a
 *    canvas and re-encode as JPEG. This works even on browsers that can
 *    display a HEIC file but wouldn't otherwise send it anywhere reliably.
 * 2. File size — phone camera photos are routinely 8-20MB. Downscaling to a
 *    sane max dimension before uploading makes scans noticeably faster and
 *    less likely to hit any request size limit.
 */
export async function normalizeToJpeg(
  blob: Blob,
  maxDimension = 1600,
  quality = 0.85
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = document.createElement("img");
    img.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Couldn't read that image file — it may be corrupted or in an unsupported format."));
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
      throw new Error("Couldn't process that image. Try a different photo.");
    }

    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}