import { NextResponse } from 'next/server';

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

const FALLBACK_TICKERS: LiveTickerItem[] = [
  { sym: 'BTC', label: 'BTC / IDR', price: 'Rp 1,54 M', delta: '+2,1%', up: true },
  { sym: 'ETH', label: 'ETH / IDR', price: 'Rp 49,3 Jt', delta: '+1,4%', up: true },
  { sym: 'SOL', label: 'SOL / IDR', price: 'Rp 3,42 Jt', delta: '+3,8%', up: true },
  { sym: 'USDT', label: 'USDT / IDR', price: 'Rp 15.870', delta: '+0,1%', up: true },
  { sym: 'USD', label: 'USD / IDR', price: 'Rp 15.865', delta: 'ECB', up: true },
  { sym: 'SGD', label: 'SGD / IDR', price: 'Rp 11.820', delta: 'ECB', up: true },
];

const FALLBACK_NEWS: LiveNewsItem[] = [
  {
    id: 'fallback-1',
    region: 'lokal',
    regionLabel: 'Indonesia',
    title: 'BI Jaga Stabilitas Nilai Tukar Rupiah dan Likuiditas Perbankan',
    summary:
      'Suku bunga acuan tetap terjaga guna menopang penyaluran kredit usaha dan daya beli rumah tangga.',
    source: 'CNBC Indonesia',
    url: 'https://www.cnbcindonesia.com/market',
    publishedAt: 'Hari ini',
  },
  {
    id: 'fallback-2',
    region: 'crypto',
    regionLabel: 'Crypto',
    title: 'Pergerakan Bitcoin dan Stablecoin Jadi Acuan Likuiditas Pasar Aset Digital',
    summary:
      'Volume transaksi aset kripto utama dan stablecoin terus dipantau pelaku pasar global.',
    source: 'CoinTelegraph',
    url: 'https://cointelegraph.com',
    publishedAt: 'Hari ini',
  },
];

function formatCompactIdr(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return 'Rp 0';
  if (num >= 1_000_000_000) {
    return `Rp ${(num / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (num >= 1_000_000) {
    return `Rp ${(num / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
}

function formatDelta(pct?: number): { delta: string; up: boolean } {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return { delta: '0,0%', up: true };
  }
  const sign = pct >= 0 ? '+' : '';
  return {
    delta: `${sign}${pct.toFixed(1).replace('.', ',')}%`,
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
  if (Number.isNaN(d.getTime())) return 'Baru saja';
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
      rawDesc.length > 160 ? `${rawDesc.slice(0, 157).trim()}...` : rawDesc;

    if (!title) continue;
    items.push({
      id: `${meta.source.toLowerCase().replace(/\s+/g, '-')}-${items.length}-${title.slice(0, 18)}`,
      region: meta.region,
      regionLabel: meta.regionLabel,
      title,
      summary: summary || title,
      source: meta.source,
      url: url || '#',
      publishedAt: dateMatch?.[1] ? formatPubDate(dateMatch[1]) : 'Hari ini',
    });
  }

  return items;
}

async function fetchWithTimeout(url: string, ms = 4500): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'stashinmeid/3.0',
        Accept: 'application/json, application/rss+xml, application/xml, text/xml',
      },
      next: { revalidate: 300 },
      signal: controller.signal,
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [fxRes, cryptoRes, cnbcRes, antaraRes, ctRes] = await Promise.all([
    fetchWithTimeout(
      'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,SGD,EUR'
    ),
    fetchWithTimeout(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=idr&include_24hr_change=true'
    ),
    fetchWithTimeout('https://www.cnbcindonesia.com/market/rss'),
    fetchWithTimeout('https://www.antaranews.com/rss/ekonomi.xml'),
    fetchWithTimeout('https://cointelegraph.com/rss'),
  ]);

  const tickers: LiveTickerItem[] = [];

  if (cryptoRes) {
    try {
      const c = (await cryptoRes.json()) as Record<
        string,
        { idr?: number; idr_24h_change?: number }
      >;
      const map: { id: string; sym: string; label: string }[] = [
        { id: 'bitcoin', sym: 'BTC', label: 'BTC / IDR' },
        { id: 'ethereum', sym: 'ETH', label: 'ETH / IDR' },
        { id: 'solana', sym: 'SOL', label: 'SOL / IDR' },
        { id: 'tether', sym: 'USDT', label: 'USDT / IDR' },
      ];
      for (const m of map) {
        const entry = c[m.id];
        if (entry?.idr) {
          const d = formatDelta(entry.idr_24h_change);
          tickers.push({
            sym: m.sym,
            label: m.label,
            price: formatCompactIdr(entry.idr),
            delta: d.delta,
            up: d.up,
          });
        }
      }
    } catch {
      // Abaikan jika gagal parse
    }
  }

  if (fxRes) {
    try {
      const fx = (await fxRes.json()) as {
        rates?: { IDR?: number; SGD?: number; EUR?: number };
      };
      const usdIdr = fx.rates?.IDR;
      const usdSgd = fx.rates?.SGD;
      const usdEur = fx.rates?.EUR;
      if (usdIdr) {
        tickers.push({
          sym: 'USD',
          label: 'USD / IDR',
          price: formatCompactIdr(usdIdr),
          delta: 'ECB',
          up: true,
        });
        if (usdSgd && usdSgd > 0) {
          tickers.push({
            sym: 'SGD',
            label: 'SGD / IDR',
            price: formatCompactIdr(usdIdr / usdSgd),
            delta: 'ECB',
            up: true,
          });
        }
        if (usdEur && usdEur > 0) {
          tickers.push({
            sym: 'EUR',
            label: 'EUR / IDR',
            price: formatCompactIdr(usdIdr / usdEur),
            delta: 'ECB',
            up: true,
          });
        }
      }
    } catch {
      // Abaikan jika gagal parse
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

  return NextResponse.json({
    tickers: tickers.length > 0 ? tickers : FALLBACK_TICKERS,
    news: news.length > 0 ? news : FALLBACK_NEWS,
    live: tickers.length > 0 || news.length > 0,
    fetchedAt: new Date().toISOString(),
  });
}
