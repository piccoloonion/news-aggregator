import { NextRequest, NextResponse } from 'next/server';

const VALID_CATEGORIES: Record<string, string> = {
  global: 'general',
  technology: 'technology',
  business: 'business',
  sports: 'sports',
};

const API_BASE = 'https://newsapi.org/v2';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const categoryParam = searchParams.get('category') || 'global';
  const searchParam = searchParams.get('search') || '';

  if (!(categoryParam in VALID_CATEGORIES)) {
    return NextResponse.json(
      { error: 'Invalid category. Use: global, technology, business, sports' },
      { status: 400 }
    );
  }

  const categoryQuery = VALID_CATEGORIES[categoryParam];
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'NEWS_API_KEY is not configured' },
      { status: 500 }
    );
  }

  const url = API_BASE + '/top-headlines?country=us&category=' + categoryQuery + '&pageSize=20&apiKey=' + apiKey;

  try {
    const response = await fetch(url, { next: { revalidate: 300 } });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'API rate limit reached. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch news from source.' },
        { status: 502 }
      );
    }

    const data: { status?: string; message?: string; articles?: Array<Record<string, unknown>> } = await response.json();

    if (data.status === 'error') {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch news' },
        { status: 502 }
      );
    }

    const rawArticles = data.articles || [];

    const articles = rawArticles.map((a: Record<string, unknown>) => ({
      source: a.source as { name: string; id: string | null },
      title: String(a.title || ''),
      description: a.description && a.description !== '[Removed]' ? String(a.description) : null,
      url: String(a.url || ''),
      urlToImage: a.urlToImage ? String(a.urlToImage) : null,
      publishedAt: String(a.publishedAt || ''),
      category: categoryParam,
    })).filter((a: { title: string }) => a.title && a.title !== '[Removed]');

    if (searchParam) {
      const lower = searchParam.toLowerCase();
      return NextResponse.json({
        articles: articles.filter((a: { title: string; description: string | null }) =>
          a.title.toLowerCase().includes(lower) ||
          (a.description && a.description.toLowerCase().includes(lower))
        ),
      });
    }

    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json(
      { error: 'Network error while fetching news' },
      { status: 500 }
    );
  }
}
