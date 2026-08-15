/**
 * Receipt thumbnails are now stored as a bare path (e.g. "{user_id}/123.jpg")
 * rather than a permanent public URL, since the storage bucket is private.
 * Older rows saved before this change may still hold the old full public
 * URL format — this extracts just the path portion either way, so both
 * signed-URL generation and delete cleanup work regardless of which format
 * a given row has.
 */
export function extractStoragePath(thumbnailValue: string): string {
  const marker = "/object/public/receipts/";
  const idx = thumbnailValue.indexOf(marker);

  if (idx !== -1) {
    return thumbnailValue.slice(idx + marker.length);
  }

  // Already a bare path (current format) — use as-is.
  return thumbnailValue;
}