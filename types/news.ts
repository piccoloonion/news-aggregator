export type Category = 'global' | 'technology' | 'business' | 'sports';

export interface NewsSource {
  id: string | null;
  name: string;
}

export interface NewsArticle {
  source: NewsSource;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  category: Category;
}

export interface NewsResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

export type NewsState = {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
};
