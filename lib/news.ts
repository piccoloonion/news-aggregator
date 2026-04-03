import type { NewsArticle, Category } from '@/types/news';

const CATEGORY_MAP: Record<Category, string> = {
  global: 'general',
  technology: 'technology',
  business: 'business',
  sports: 'sports',
};

const API_BASE = 'https://newsapi.org/v2';

export async function fetchNews(category: Category): Promise<NewsArticle[]> {
  const categoryQuery = CATEGORY_MAP[category];
  const apiKey = process.env.NEWS_API_KEY;
  const url = API_BASE + '/top-headlines?category=' + categoryQuery + '&pageSize=20&apiKey=' + apiKey;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('API rate limit reached. Please wait and try again.');
        }
        if (response.status === 401) {
          throw new Error('Invalid API key. Check your NEWS_API_KEY.');
        }
        throw new Error('News API error: ' + response.status);
      }

      const data = await response.json();
      if (data === null) throw new Error('Empty response from API');
      
      const record = data as Record<string, unknown>;

      if (record.status === 'error') {
        throw new Error(String(record.message || 'Failed to fetch news'));
      }

      const articles = record.articles as Array<Record<string, unknown>> | undefined;

      return (articles || [])
        .filter((a) => a && typeof a === 'object' && typeof (a as Record<string, unknown>).title === 'string' && (a as Record<string, unknown>).title !== '[Removed]')
        .map((a) => {
          const r = a as Record<string, unknown>;
          return {
            source: (r.source || { name: 'Unknown', id: null }) as { name: string; id: string | null },
            title: String(r.title),
            description: r.description && r.description !== '[Removed]' ? String(r.description) : null,
            url: String(r.url || ''),
            urlToImage: r.urlToImage ? String(r.urlToImage) : null,
            publishedAt: String(r.publishedAt || ''),
            category,
          };
        });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error('Failed to fetch news');
}
