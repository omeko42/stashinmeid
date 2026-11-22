import { NextRequest, NextResponse } from 'next/server';

export interface LiveTickerItem {
  sym: string;
  label: string;
  price: string;
  delta: string;
  up: boolean;
}

export interface LiveNewsItem {
  id: string;
  region: 'lokal' | 'global' | 'crypto';
  regionLabel: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
}

const ALLOWED_BASES = ['IDR', 'USD', 'EUR', 'SGD'] as const;
type BaseCurrency = (typeof ALLOWED_BASES)[number];

function formatPriceByBase(num: number, base: BaseCurrency): string {
  if (!Number.isFinite(num) || num <= 0) return '0';
  if (base === 'IDR') {
    if (num >= 1_000_000_000) {
      return `Rp ${(num / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
    }
    if (num >= 1_000_000) {
      return `Rp ${(num / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
    }
    return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
  }
  const symbol = base === 'USD' ? '$' : base === 'EUR' ? '€' : 'S$';
  if (num >= 1000) {
    return `${symbol}${Math.round(num).toLocaleString('en-US')}`;
  }
  if (num >= 1) {
    return `${symbol}${num.toFixed(2)}`;
  }
  return `${symbol}${num.toFixed(4)}`;
}

function formatDelta(pct?: number): { delta: string; up: boolean } {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return { delta: '0.0%', up: true };
  }
  const sign = pct >= 0 ? '+' : '';
  return {
    delta: `${sign}${pct.toFixed(2)}%`,
    up: pct >= 0,
  };
}

function decodeHtml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPubDate(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Live';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function parseRssItems(
  xml: string,
  meta: {
    region: LiveNewsItem['region'];
    regionLabel: string;
    source: string;
    limit: number;
  }
): LiveNewsItem[] {
  const items: LiveNewsItem[] = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const rawItem of itemMatches.slice(0, meta.limit)) {
    const titleMatch = rawItem.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = rawItem.match(/<link>([\s\S]*?)<\/link>/i);
    const descMatch = rawItem.match(/<description>([\s\S]*?)<\/description>/i);
    const dateMatch = rawItem.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    const title = decodeHtml(titleMatch?.[1] || '');
    const url = decodeHtml(linkMatch?.[1] || '');
    const rawDesc = decodeHtml(descMatch?.[1] || '');
    const summary =
      rawDesc.length > 155 ? `${rawDesc.slice(0, 152).trim()}...` : rawDesc;

    if (!title) continue;
    items.push({
      id: `${meta.source.toLowerCase().replace(/\s+/g, '-')}-${items.length}-${title.slice(0, 18)}`,
      region: meta.region,
      regionLabel: meta.regionLabel,
      title,
      summary: summary || title,
      source: meta.source,
      url: url || '#',
      publishedAt: dateMatch?.[1] ? formatPubDate(dateMatch[1]) : 'Live',
    });
  }

  return items;
}

async function fetchWithTimeout(
  url: string,
  ms = 4500
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'stashinmeid/3.0',
        Accept: 'application/json, application/rss+xml, application/xml, text/xml',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const rawBase = (req.nextUrl.searchParams.get('base') || 'IDR').toUpperCase();
  const base: BaseCurrency = ALLOWED_BASES.includes(rawBase as BaseCurrency)
    ? (rawBase as BaseCurrency)
    : 'IDR';
  const includeNews = req.nextUrl.searchParams.get('news') !== '0';

  const fxTargets = ['USD', 'EUR', 'SGD', 'GBP', 'JPY', 'AUD', 'IDR'].filter(
    (c) => c !== base
  );
  const vsLower = base.toLowerCase();

  const [fxRes, cryptoRes, cnbcRes, antaraRes, ctRes] = await Promise.all([
    fetchWithTimeout(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${fxTargets.join(',')}`
    ),
    fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=${vsLower}&include_24hr_change=true`
    ),
    includeNews
      ? fetchWithTimeout('https://www.cnbcindonesia.com/market/rss')
      : Promise.resolve(null),
    includeNews
      ? fetchWithTimeout('https://www.antaranews.com/rss/ekonomi.xml')
      : Promise.resolve(null),
    includeNews
      ? fetchWithTimeout('https://cointelegraph.com/rss')
      : Promise.resolve(null),
  ]);

  const tickers: LiveTickerItem[] = [];

  // 1. Live Crypto vs Base Currency (CoinGecko)
  if (cryptoRes) {
    try {
      const c = (await cryptoRes.json()) as Record<
        string,
        Record<string, number>
      >;
      const coins = [
        { id: 'bitcoin', sym: 'BTC' },
        { id: 'ethereum', sym: 'ETH' },
        { id: 'solana', sym: 'SOL' },
        { id: 'tether', sym: 'USDT' },
      ];
      for (const coin of coins) {
        const entry = c[coin.id];
        const val = entry?.[vsLower];
        const chg = entry?.[`${vsLower}_24h_change`];
        if (val) {
          const d = formatDelta(chg);
          tickers.push({
            sym: `${coin.sym}/${base}`,
            label: `${coin.sym} / ${base}`,
            price: formatPriceByBase(val, base),
            delta: d.delta,
            up: d.up,
          });
        }
      }
    } catch {
      // Abaikan error parse
    }
  }

  // 2. Live Forex vs Base Currency (Frankfurter ECB)
  // Frankfurter returns: 1 BASE = rate * TARGET. So 1 TARGET = (1 / rate) BASE.
  if (fxRes) {
    try {
      const fx = (await fxRes.json()) as {
        rates?: Record<string, number>;
        date?: string;
      };
      for (const target of fxTargets) {
        const inv = fx.rates?.[target];
        if (inv && inv > 0) {
          const valueInBase = 1 / inv;
          tickers.push({
            sym: `${target}/${base}`,
            label: `${target} / ${base}`,
            price: formatPriceByBase(valueInBase, base),
            delta: 'ECB',
            up: true,
          });
        }
      }
    } catch {
      // Abaikan error parse
    }
  }

  const news: LiveNewsItem[] = [];
  if (cnbcRes) {
    const xml = await cnbcRes.text().catch(() => '');
    news.push(
      ...parseRssItems(xml, {
        region: 'lokal',
        regionLabel: 'Indonesia · Market',
        source: 'CNBC Indonesia',
        limit: 4,
      })
    );
  }
  if (antaraRes) {
    const xml = await antaraRes.text().catch(() => '');
    news.push(
      ...parseRssItems(xml, {
        region: 'lokal',
        regionLabel: 'Indonesia · Ekonomi',
        source: 'Antara News',
        limit: 3,
      })
    );
  }
  if (ctRes) {
    const xml = await ctRes.text().catch(() => '');
    news.push(
      ...parseRssItems(xml, {
        region: 'crypto',
        regionLabel: 'Global · Crypto',
        source: 'CoinTelegraph',
        limit: 3,
      })
    );
  }

  return NextResponse.json(
    {
      base,
      tickers,
      news,
      live: tickers.length > 0,
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
