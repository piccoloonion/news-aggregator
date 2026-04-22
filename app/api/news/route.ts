import { NextRequest, NextResponse } from 'next/server';

const VALID_CATEGORIES: Record<string, string> = {
  global: 'general',
  technology: 'technology',
  business: 'business',
  sports: 'sports',
};

const RSS_FEEDS: Record<string, string[]> = {
  global: [
    'https://feeds.bbci.co.uk/news/rss.xml',
    'https://www.theguardian.com/uk/rss',
  ],
  technology: [
    'https://news.ycombinator.com/rss',
    'https://www.reddit.com/r/technology/.rss',
  ],
  business: [
    'https://www.reddit.com/r/business/.rss',
    'https://feeds.bbci.co.uk/news/business/rss.xml',
  ],
  sports: [
    'https://www.reddit.com/r/sports/.rss',
    'https://feeds.bbci.co.uk/sport/rss.xml',
  ],
};

const API_BASE = 'https://newsapi.org/v2';
const MAX_SEARCH_LENGTH = 100;

// Simple in-memory rate limiter (per-process).
const RATE_LIMIT_MAP = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getRateLimitKey(ip: string): string {
  return `ratelimit:${ip}`;
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const key = getRateLimitKey(ip);
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(key);

  if (!entry || now > entry.resetAt) {
    RATE_LIMIT_MAP.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeArticle(
  a: Record<string, unknown>,
  category: string
): { validForImage: boolean; article: Record<string, unknown> } {
  const url = String(a.url || '');
  const urlToImage = a.urlToImage ? String(a.urlToImage) : null;
  const isValid = isValidUrl(url);
  const safeImage = urlToImage && isValidUrl(urlToImage) ? urlToImage : null;
  const rawTitle = String(a.title || '');
  const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').trim();
  const rawDesc = a.description ? String(a.description) : null;
  const cleanDesc = rawDesc ? rawDesc.replace(/<[^>]*>/g, '').trim() : null;

  const sourceObj = typeof a.source === 'object' && a.source !== null
    ? (a.source as Record<string, unknown>)
    : {};
  const sourceName = String(sourceObj.name || 'Unknown').replace(/<[^>]*>/g, '').trim();
  const sourceId = sourceObj.id ? String(sourceObj.id) : null;

  return {
    validForImage: !!safeImage,
    article: {
      source: { name: sourceName, id: sourceId },
      title: cleanTitle || '[Untitled]',
      description: cleanDesc,
      url,
      urlToImage: safeImage,
      publishedAt: String(a.publishedAt || ''),
      category,
    },
  };
}

// --- RSS Fallback Parser ---

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseRSS(xml: string, category: string, maxItems = 10): Record<string, unknown>[] {
  const articles: Record<string, unknown>[] = [];
  const itemRegex = /<item>[\s\S]*?<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && articles.length < maxItems) {
    const itemXml = match[0];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title && link && isValidUrl(link)) {
      articles.push({
        source: { name: 'RSS Feed', id: null },
        title: cleanText(title),
        description: description ? cleanText(description) : null,
        url: link,
        urlToImage: null,
        publishedAt: pubDate || '',
        category,
      });
    }
  }

  return articles;
}

async function fetchRSSFallback(category: string): Promise<Record<string, unknown>[]> {
  const feeds = RSS_FEEDS[category] || RSS_FEEDS.global;
  const allArticles: Record<string, unknown>[] = [];

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, { next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const xml = await res.text();
      const articles = parseRSS(xml, category, 10);
      allArticles.push(...articles);
    } catch (e) {
      console.error(`RSS fallback error for ${feedUrl}:`, e);
    }
  }

  return allArticles;
}

export async function GET(request: NextRequest) {
  // Rate limiting based on IP
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a minute.' },
      { status: 429 }
    );
  }

  const { searchParams } = request.nextUrl;
  const categoryParam = searchParams.get('category') || 'global';

  if (!(categoryParam in VALID_CATEGORIES)) {
    return NextResponse.json(
      { error: 'Invalid category parameter.' },
      { status: 400 }
    );
  }

  const searchParam = (searchParams.get('search') || '').trim();
  if (searchParam.length > MAX_SEARCH_LENGTH) {
    return NextResponse.json(
      { error: 'Search query is too long.' },
      { status: 400 }
    );
  }

  const categoryQuery = VALID_CATEGORIES[categoryParam];
  const apiKey = process.env.NEWS_API_KEY;
  let articles: Record<string, unknown>[] = [];
  let usedFallback = false;

  // Try NewsAPI first if key exists
  if (apiKey) {
    const url = API_BASE + '/top-headlines?country=us&category=' + encodeURIComponent(categoryQuery) + '&pageSize=20&apiKey=' + encodeURIComponent(apiKey);

    try {
      const response = await fetch(url, { next: { revalidate: 86400 } });

      if (response.ok) {
        const data = await response.json();
        const record = data as Record<string, unknown>;

        if (record.status !== 'error' && Array.isArray(record.articles)) {
          const rawArticles = record.articles as Array<Record<string, unknown>>;
          articles = rawArticles
            .filter((a) => {
              if (!a || typeof a !== 'object') return false;
              const raw = a.title;
              return typeof raw === 'string' && raw.trim() !== '' && raw !== '[Removed]';
            })
            .map((a) => {
              const { article } = sanitizeArticle(a, categoryParam);
              return article;
            })
            .filter((article) => article.url && isValidUrl(article.url as string));
        }
      } else {
        console.error('NewsAPI error:', response.status, response.statusText);
        if (response.status === 429 || response.status >= 500) {
          usedFallback = true;
        }
      }
    } catch (e) {
      console.error('NewsAPI fetch error:', e);
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }

  // If NewsAPI failed or no key, use RSS fallback
  if (usedFallback || articles.length === 0) {
    console.log('[News] Falling back to RSS feeds for category:', categoryParam);
    const rssArticles = await fetchRSSFallback(categoryParam);
    // Merge and dedupe by URL
    const seen = new Set(articles.map((a) => a.url as string));
    for (const a of rssArticles) {
      if (!seen.has(a.url as string)) {
        seen.add(a.url as string);
        articles.push(a);
      }
    }
  }

  // Apply server-side search filtering if search parameter is provided
  let filteredArticles = articles;
  if (searchParam) {
    const safeSearch = searchParam.replace(/[<>\"'&]/g, '');
    const safeLower = safeSearch.toLowerCase();
    filteredArticles = filteredArticles.filter((a) => {
      const title = String(a.title || '').toLowerCase();
      const desc = a.description ? String(a.description).toLowerCase() : '';
      return title.includes(safeLower) || desc.includes(safeLower);
    });
  }

  // Set security headers
  const headers = new Headers();
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('RateLimit-Remaining', String(rateLimit.remaining));
  headers.set('X-Data-Source', usedFallback ? 'rss-fallback' : 'newsapi');

  return NextResponse.json(
    { articles: filteredArticles },
    { headers }
  );
}
