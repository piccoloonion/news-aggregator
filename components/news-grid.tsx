import { NewsCard } from "@/components/news-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { NewsArticle } from "@/types/news";

interface NewsGridProps {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  searchQuery?: string;
}

export function NewsGrid({ articles, loading, error, onRetry, searchQuery }: NewsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[16/9] w-full rounded-lg" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-3 w-[60%]" />
            <Skeleton className="h-3 w-[40%]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <h3 className="mb-2 text-lg font-semibold">Failed to load news</h3>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="mb-2 text-lg font-semibold">No articles found</h3>
        <p className="text-sm text-muted-foreground">
          {searchQuery ? `No results for "${searchQuery}"` : "Try selecting a different category."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, i) => (
        <NewsCard key={article.url + i} article={article} />
      ))}
    </div>
  );
}
