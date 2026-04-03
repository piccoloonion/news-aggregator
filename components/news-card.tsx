import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Clock } from "lucide-react";
import type { NewsArticle } from "@/types/news";

interface NewsCardProps {
  article: NewsArticle;
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function NewsCard({ article }: NewsCardProps) {
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer">
      <Card className="group h-full overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg border-border/50">
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-muted/50 to-muted">
          {article.urlToImage ? (
            <img
              src={article.urlToImage}
              alt={article.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget.style.display = 'none');
                (e.currentTarget.parentElement!.style.display = 'flex');
              }}
            />
          ) : null}
          {!article.urlToImage && (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
          )}
          {/* Source badge */}
          <div className="absolute top-2 left-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur-sm">
            {article.source.name}
          </div>
        </div>
        {/* Content */}
        <CardContent className="p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          {article.description && (
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
              {article.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{getRelativeTime(article.publishedAt)}</span>
            <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
