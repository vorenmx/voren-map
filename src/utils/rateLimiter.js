export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createRateLimiter(delayMs) {
  let lastCall = 0;

  return async function throttle() {
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed < delayMs) {
      await sleep(delayMs - elapsed);
    }
    lastCall = Date.now();
  };
}
