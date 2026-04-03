import { NextRequest, NextResponse } from 'next/server';

const VALID_CATEGORIES: Record<string, string> = {
  global: 'general',
  technology: 'technology',
  business: 'business',
  sports: 'sports',
};

const API_BASE = 'https://newsapi.org/v2';
const MAX_SEARCH_LENGTH = 100;
const ALLOWED_IMAGE_HOSTS_DEFAULT = true; // Only allow http/https URLs

// Simple in-memory rate limiter (per-process).
// For production with multiple instances, use Redis or similar.
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

// Validate that a URL is a safe http(s) URL
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Sanitize article data: validate URLs, strip dangerous content
function sanitizeArticle(
  a: Record<string, unknown>,
  category: string
): { validForImage: boolean; article: Record<string, unknown> } {
  const url = String(a.url || '');
  const urlToImage = a.urlToImage ? String(a.urlToImage) : null;

  // Reject articles without a valid http(s) URL
  const isValid = isValidUrl(url);

  // Validate image URL: must be http/https or null
  const safeImage = urlToImage && isValidUrl(urlToImage) ? urlToImage : null;

  // Clean title: strip potential HTML/script tags
  const rawTitle = String(a.title || '');
  const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').trim();

  // Clean description: strip potential HTML/script tags
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

  // Validate category against allowlist
  if (!(categoryParam in VALID_CATEGORIES)) {
    return NextResponse.json(
      { error: 'Invalid category parameter.' },
      { status: 400 }
    );
  }

  // Validate search parameter: max length, alphanumeric + spaces + basic punctuation
  const searchParam = (searchParams.get('search') || '').trim();
  if (searchParam.length > MAX_SEARCH_LENGTH) {
    return NextResponse.json(
      { error: 'Search query is too long.' },
      { status: 400 }
    );
  }

  const categoryQuery = VALID_CATEGORIES[categoryParam];
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'News service is currently unavailable.' },
      { status: 503 }
    );
  }

  const url = API_BASE + '/top-headlines?country=us&category=' + encodeURIComponent(categoryQuery) + '&pageSize=20&apiKey=' + encodeURIComponent(apiKey);

  try {
    const response = await fetch(url, { next: { revalidate: 86400 } });

    if (!response.ok) {
      // Log internally for debugging (in production, use a proper logger)
      console.error('NewsAPI error:', response.status, response.statusText);

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'News service is temporarily rate-limited. Please try again in a moment.' },
          { status: 429 }
        );
      }
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'News service is currently unavailable.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch news from source.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const record = data as Record<string, unknown>;

    if (record.status === 'error') {
      // Never echo the API error message to the client
      console.error('NewsAPI returned error status');
      return NextResponse.json(
        { error: 'Failed to fetch news from source.' },
        { status: 502 }
      );
    }

    const rawArticles = Array.isArray(record.articles) ? record.articles : [];

    const articles = rawArticles
      .filter((a): a is Record<string, unknown> => {
        if (!a || typeof a !== 'object') return false;
        const raw = (a as Record<string, unknown>).title;
        return typeof raw === 'string' && raw.trim() !== '' && raw !== '[Removed]';
      })
      .map((a) => {
        const { validForImage, article } = sanitizeArticle(a, categoryParam);
        return { article, validForImage };
      })
      .filter(({ article }) => article.url && isValidUrl(article.url as string));

    // Apply server-side search filtering if search parameter is provided
    let filteredArticles = articles.map(({ article }) => article);
    if (searchParam) {
      const lower = searchParam.toLowerCase();
      // Sanitize search input: only allow safe characters
      const safeSearch = searchParam.replace(/[<>\"'&]/g, '');
      const safeLower = safeSearch.toLowerCase();
      filteredArticles = filteredArticles.filter((a: Record<string, unknown>) => {
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

    return NextResponse.json(
      { articles: filteredArticles },
      { headers }
    );
  } catch {
    return NextResponse.json(
      { error: 'Network error while fetching news.' },
      { status: 500 }
    );
  }
}
