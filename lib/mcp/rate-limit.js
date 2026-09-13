const windows = new Map();

export function takeRateLimit(key, limit, now = Date.now()) {
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const current = windows.get(key);
  if (!current || current.windowStart !== windowStart) {
    windows.set(key, { windowStart, count: 1 });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((windowStart + 60_000 - now) / 1_000))
    };
  }
  return { allowed: true, remaining: limit - current.count, retryAfter: 0 };
}
