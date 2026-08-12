/**
 * Calls Gemini once, and if it hits a rate limit (429), waits briefly and
 * retries exactly once before giving up. Gemini's free tier caps requests
 * per minute — a single retry after a short pause resolves most transient
 * "just went over the limit" cases without making the person wait for the
 * full minute to reset, while still failing cleanly if the limit is
 * genuinely exhausted for longer.
 */
export async function generateWithRetry(model: any, parts: any[], retryDelayMs = 8000) {
  try {
    return await model.generateContent(parts);
  } catch (err: any) {
    const status = err?.status || err?.response?.status;
    if (status === 429) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      return await model.generateContent(parts);
    }
    throw err;
  }
}