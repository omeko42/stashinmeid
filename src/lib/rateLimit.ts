/**
 * Rate limiter in-memory berbasis sliding window.
 *
 * Catatan penting: ini hanya melindungi satu instance Node.js. Di Vercel
 * (serverless) tiap instance punya memory sendiri, jadi batas sebenarnya
 * adalah "per instance". Untuk apps dengan traffic tinggi, ganti dengan
 * Upstash Redis / Vercel KV. Untuk pemanggilan AI berbayar seperti scan struk,
 * ini sudah cukup menahan penyalahgunakan yang tidak disengaja.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Bersihkan bucket kosong secara berkala agar tidak tumbuh tanpa batas.
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, bucket] of buckets) {
    // Semua bucket menyimpan window timestamp request; bucket tanpa request
    // aktif di window terpanjang dibuang saat cleanup. Retensi 24 jam untuk
    // menghindari pertumbuhan map tanpa batas di worker yang hangat.
    bucket.hits = bucket.hits.filter((t) => now - t < 24 * 60 * 60 * 1000);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Cek dan consume satu jatah request.
 * @param key identitas pemanggil (mis. IP)
 * @param limit jumlah maksimum request dalam satu jendela
 * @param windowMs panjang jendela dalam milidetik
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  const cutoff = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfterSeconds,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    limit,
    retryAfterSeconds: 0,
  };
}

/**
 * Ambil identifier pemanggil dari request: header forwarded-for, lalu x-real-ip.
 */
export function clientIp(req: Request): string {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? 'unknown';
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
  };
}
