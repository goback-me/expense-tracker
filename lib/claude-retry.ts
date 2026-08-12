/**
 * Calls Claude once, and if it hits a rate limit (429), waits briefly and
 * retries exactly once before giving up. Anthropic's paid tiers have much
 * higher throughput than Gemini's free tier, so this should rarely trigger
 * — it's just a safety net for legitimate bursts of usage.
 */
export async function createMessageWithRetry(
  anthropic: any,
  params: any,
  retryDelayMs = 5000
) {
  try {
    return await anthropic.messages.create(params);
  } catch (err: any) {
    const status = err?.status;
    if (status === 429) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      return await anthropic.messages.create(params);
    }
    throw err;
  }
}